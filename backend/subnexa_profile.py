"""Private completion totals, keyed only by verified Google identity."""
import hashlib
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from subnexa_usage import rpc, settings

router = APIRouter()


def _hash(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def record_completed(user, job_id):
    if not isinstance(user, dict) or not isinstance(user.get('sub'), str) or not user['sub'].strip():
        return False
    if not isinstance(job_id, str) or not job_id:
        return False
    try:
        result = rpc('subnexa_profile_complete_v1', {
            'p_scope': settings()[2], 'p_user': _hash(user['sub']), 'p_job': _hash(job_id)})
        return result.get('recorded') is True
    except Exception as error:
        print('[SubNexa Profile] completion save unavailable: ' + type(error).__name__, flush=True)
        return False  # A statistics outage must not erase the finished subtitle.


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
