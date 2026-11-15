"""Private completion totals, keyed only by verified Google identity."""
import hashlib
import re
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
from subnexa_usage import rpc, settings

router = APIRouter()


def _hash(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def _clean_filename(value):
    if not isinstance(value, str):
        return ''
    leaf = re.split(r'[/\\]', value)[-1]
    leaf = ''.join(c for c in leaf if ord(c) >= 32 and ord(c) != 127)
    return ' '.join(leaf.split())[:200].strip()


def _record_file(user, job_id, filename, output_format, cues):
    """Remember the file name for the user's own profile (idempotent per job)."""
    name = _clean_filename(filename)
    if not name:
        return False
    try:
        result = rpc('subnexa_user_file_record_v1', {
            'p_scope': settings()[2], 'p_user': _hash(user['sub']), 'p_job': _hash(job_id),
            'p_filename': name,
            'p_format': output_format if output_format in ('srt', 'ass') else 'srt',
            'p_cues': cues if type(cues) is int and cues >= 0 else None})
        return result.get('recorded') is True
    except Exception as error:
        print('[SubNexa Profile] file name save unavailable: ' + type(error).__name__, flush=True)
        return False  # The file list is a convenience; never block the finished subtitle.


def record_completed(user, job_id, filename=None, output_format=None, cues=None):
    if not isinstance(user, dict) or not isinstance(user.get('sub'), str) or not user['sub'].strip():
        return False
    if not isinstance(job_id, str) or not job_id:
        return False
    recorded = False
    try:
        result = rpc('subnexa_profile_complete_v1', {
            'p_scope': settings()[2], 'p_user': _hash(user['sub']), 'p_job': _hash(job_id)})
        recorded = result.get('recorded') is True
    except Exception as error:
        print('[SubNexa Profile] completion save unavailable: ' + type(error).__name__, flush=True)
        # A statistics outage must not erase the finished subtitle.
    if filename:
        _record_file(user, job_id, filename, output_format, cues)
    return recorded


@router.get('/profile/stats')
def profile_stats(request: Request):
    from subnexa_auth import COOKIE_NAME, _user_from_cookie_value
    headers = {'Cache-Control': 'no-store', 'Vary': 'Cookie'}
    user = _user_from_cookie_value(request.cookies.get(COOKIE_NAME))
    if not user or not isinstance(user.get('sub'), str) or not user['sub'].strip():
        return JSONResponse({'detail': 'Sign in to view your profile.'}, status_code=401, headers=headers)
    try:
        result = rpc('subnexa_profile_stats_v1', {'p_scope': settings()[2], 'p_user': _hash(user['sub'])})
        count = result.get('completed_files')
        if type(count) is not int or count < 0 or not isinstance(result.get('tracking_since'), str):
            raise ValueError('Invalid profile statistics')
        return JSONResponse({'completed_files': count, 'tracking_since': result['tracking_since']}, headers=headers)
    except Exception:
        return JSONResponse({'detail': 'Translation statistics are temporarily unavailable.'}, status_code=503, headers=headers)


@router.get('/profile/summary')
def profile_summary(request: Request, limit: int = Query(50, ge=1, le=100),
                    offset: int = Query(0, ge=0, le=100000)):
    """Everything the signed-in user sees on their own profile page. Own data only."""
    from subnexa_auth import COOKIE_NAME, _user_from_cookie_value
    headers = {'Cache-Control': 'no-store', 'Vary': 'Cookie'}
    user = _user_from_cookie_value(request.cookies.get(COOKIE_NAME))
    if not user or not isinstance(user.get('sub'), str) or not user['sub'].strip():
        return JSONResponse({'detail': 'Sign in to view your profile.'}, status_code=401, headers=headers)
    scope, user_hash = settings()[2], _hash(user['sub'])
    try:
        stats = rpc('subnexa_profile_stats_v1', {'p_scope': scope, 'p_user': user_hash})
        completed = stats.get('completed_files')
        since = stats.get('tracking_since')
        if type(completed) is not int or completed < 0 or not isinstance(since, str):
            raise ValueError('Invalid profile statistics')
    except Exception:
        return JSONResponse({'detail': 'Translation statistics are temporarily unavailable.'},
                            status_code=503, headers=headers)

    files, named_total, files_unavailable = [], 0, False
    try:
        listing = rpc('subnexa_user_files_list_v1', {
            'p_scope': scope, 'p_user': user_hash, 'p_limit': limit, 'p_offset': offset})
        rows, total = listing.get('files'), listing.get('total')
        if not isinstance(rows, list) or type(total) is not int or total < 0:
            raise ValueError('Invalid file list')
        named_total = total
        for row in rows:
            if isinstance(row, dict) and isinstance(row.get('filename'), str):
                cues = row.get('cues')
                files.append({'filename': row['filename'][:200],
                              'format': row.get('format') if row.get('format') in ('srt', 'ass') else 'srt',
                              'cues': cues if type(cues) is int else None,
                              'completed_at': row.get('completed_at') if isinstance(row.get('completed_at'), str) else None})
    except Exception:
        files_unavailable = True   # counts still work if the file list is not set up yet

    today, is_admin = None, False
    try:
        from subnexa_fairuse import account
        status = account(verified_user=user)
        is_admin = status.get('is_admin') is True
        today = {'files': status.get('files'), 'file_limit': status.get('file_limit'),
                 'reset_at': status.get('reset_at'), 'unlimited': is_admin or bool(status.get('unlimited'))}
    except Exception:
        today = None

    return JSONResponse({
        'name': str(user.get('name') or '')[:120], 'email': str(user.get('email') or '')[:320],
        'is_admin': is_admin, 'completed_files': completed, 'tracking_since': since, 'today': today,
        'files': files, 'files_total': named_total, 'files_unavailable': files_unavailable,
        'earlier_unnamed': max(0, completed - named_total)}, headers=headers)
