"""Authenticated, rate-limited community subtitle submissions. Never public until approval."""
import hashlib
import os
import re
import uuid
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from subnexa_auth import _user
from subnexa_library_auto import request as storage_request
from subnexa_fairuse import identity

router = APIRouter()

@router.post('/community/subtitle')
async def submit_subtitle(request: Request, title: str = Form(...), year: str = Form(''), subtitle: UploadFile = File(...)):
    user = _user(request)
    origin = request.headers.get('origin', '').rstrip('/')
    allowed = os.getenv('SUBNEXA_FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    if origin != allowed:
        raise HTTPException(403, 'Request origin is not allowed.')
    title = ' '.join(title.split())
    if not 1 <= len(title) <= 120 or (year and not re.fullmatch(r'\d{4}', year)):
        raise HTTPException(400, 'Invalid title or year.')
    name = (subtitle.filename or '').lower()
    fmt = 'srt' if name.endswith('.srt') else 'ass' if name.endswith('.ass') else ''
    if not fmt:
        raise HTTPException(400, 'Upload an SRT or ASS subtitle.')
    data = await subtitle.read(2 * 1024 * 1024 + 1)
    if not data or len(data) > 2 * 1024 * 1024:
        raise HTTPException(413, 'Subtitle must be under 2 MB.')
    try:
        contents = data.decode('utf-8-sig')
    except UnicodeDecodeError:
        raise HTTPException(400, 'Subtitle must be UTF-8.')
    if (fmt == 'srt' and '-->' not in contents) or (fmt == 'ass' and '[Events]' not in contents):
        raise HTTPException(400, 'Invalid subtitle content.')
    digest = hashlib.sha256(data).hexdigest()
    sid = str(uuid.uuid4())
    try:
        # Database reservation first: atomic daily quota and duplicate checking.
        from subnexa_usage import rpc, settings
        result = rpc('subnexa_community_subtitle_reserve_v1', {
            'p_scope': settings()[2], 'p_user': identity(user['sub']),
            'p_id': sid, 'p_title': title, 'p_year': year, 'p_format': fmt, 'p_sha256': digest,
        })
        if not result.get('allowed'):
            raise HTTPException(429 if result.get('reason') == 'limit' else 409,
                                'Daily upload limit reached.' if result.get('reason') == 'limit' else 'This subtitle is already submitted or published.')
        storage_request('POST', f'/storage/v1/object/subnexa-library/community-pending/{sid}/subtitle.{fmt}',
                        data=data, headers={'Content-Type': 'text/plain; charset=utf-8', 'x-upsert': 'false'},
                        accepted=(200,201))
        storage_request('PATCH', f'/rest/v1/subnexa_community_subtitles?id=eq.{sid}',
                        payload={'status':'pending'}, headers={'Content-Type':'application/json', 'Prefer':'return=minimal'},
                        accepted=(200,204))
        return {'saved': True, 'status': 'pending'}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, 'Submission could not be completed. Please retry later.')
