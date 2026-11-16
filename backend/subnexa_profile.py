"""Private completion totals, keyed only by verified Google identity."""
import hashlib
import re
import unicodedata
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
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


# ---------------------------------------------------------------------------
# Public display name: the "Translated by ..." name shown in the public library.
# Stored per user (hashed id, like the other profile data). Falls back to the
# Google account name when the user has not chosen one.
# ---------------------------------------------------------------------------
_NAME_MIN, _NAME_MAX = 2, 40
_NAME_PUNCT = set(" .'-_")
_NAME_BLOCKED = re.compile(r"http|www\.|\.(com|net|org|lk|io|me|xyz|info|co|app|dev)\b|subnexa|admin", re.I)


def _clean_public_name(value):
    """Return a safe public name, or None when it is not acceptable."""
    if not isinstance(value, str):
        return None
    name = ' '.join(value.split())
    if not (_NAME_MIN <= len(name) <= _NAME_MAX):
        return None
    for ch in name:
        # Letters, combining marks (Sinhala vowel signs), digits, ZWJ and a few punctuation marks.
        if ch == '\u200d' or ch in _NAME_PUNCT or unicodedata.category(ch)[0] in 'LMN':
            continue
        return None
    if not any(unicodedata.category(ch)[0] == 'L' for ch in name):
        return None
    if _NAME_BLOCKED.search(name):
        return None
    return name


def _custom_name(user):
    result = rpc('subnexa_display_name_get_v1', {'p_scope': settings()[2], 'p_user': _hash(user['sub'])})
    name = result.get('display_name') if isinstance(result, dict) else None
    return name.strip() if isinstance(name, str) and name.strip() else None


def public_display_name(user):
    """Name to show publicly for this signed-in user. Never raises."""
    google_name = str(user.get('name') or '')[:120]
    try:
        return _custom_name(user) or google_name
    except Exception as error:
        print('[SubNexa Profile] display name lookup unavailable: ' + type(error).__name__, flush=True)
        return google_name


class DisplayNameBody(BaseModel):
    display_name: str = Field('', max_length=200)


@router.get('/profile/display-name')
def get_display_name(request: Request):
    from subnexa_auth import COOKIE_NAME, _user_from_cookie_value
    headers = {'Cache-Control': 'no-store', 'Vary': 'Cookie'}
    user = _user_from_cookie_value(request.cookies.get(COOKIE_NAME))
    if not user or not isinstance(user.get('sub'), str) or not user['sub'].strip():
        return JSONResponse({'detail': 'Sign in to view your profile.'}, status_code=401, headers=headers)
    google_name = str(user.get('name') or '')[:120]
    try:
        custom = _custom_name(user)
    except Exception:
        return JSONResponse({'detail': 'Display name is temporarily unavailable.'}, status_code=503, headers=headers)
    return JSONResponse({'display_name': custom, 'google_name': google_name,
                         'effective_name': custom or google_name}, headers=headers)


@router.post('/profile/display-name')
def set_display_name(body: DisplayNameBody, request: Request):
    """Set the public name. An empty value goes back to the Google account name."""
    from subnexa_auth import COOKIE_NAME, _user_from_cookie_value, FRONTEND
    headers = {'Cache-Control': 'no-store', 'Vary': 'Cookie'}
    if request.headers.get('origin') != FRONTEND:
        return JSONResponse({'detail': 'Untrusted origin.'}, status_code=403, headers=headers)
    user = _user_from_cookie_value(request.cookies.get(COOKIE_NAME))
    if not user or not isinstance(user.get('sub'), str) or not user['sub'].strip():
        return JSONResponse({'detail': 'Sign in to change your display name.'}, status_code=401, headers=headers)
    raw = body.display_name or ''
    if raw.strip():
        name = _clean_public_name(raw)
        if name is None:
            return JSONResponse({'detail': 'Use 2 to 40 letters, numbers, spaces or . - _ \' only, with no links and not containing "subnexa" or "admin".'},
                                status_code=400, headers=headers)
    else:
        name = ''
    try:
        rpc('subnexa_display_name_set_v1', {'p_scope': settings()[2], 'p_user': _hash(user['sub']), 'p_name': name})
    except Exception as error:
        print('[SubNexa Profile] display name save unavailable: ' + type(error).__name__, flush=True)
        return JSONResponse({'detail': 'Could not save your display name. Please try again.'}, status_code=503, headers=headers)
    google_name = str(user.get('name') or '')[:120]
    return JSONResponse({'display_name': name or None, 'google_name': google_name,
                         'effective_name': name or google_name}, headers=headers)
