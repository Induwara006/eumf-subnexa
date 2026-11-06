"""User directory: backend-only service-role access; no public user lists."""
import base64
import hashlib
import hmac
import json
import logging
import os
import re
import time
from urllib.parse import urlsplit
import requests
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import JSONResponse

router = APIRouter()
log = logging.getLogger(__name__)
HEADERS = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"}

def enabled():
    return os.getenv('SUBNEXA_USERS_ENABLED','0').lower() in {'1','true','yes'}

def db(path, body=None):
    url = os.getenv('SUPABASE_URL','').rstrip('/')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY','')
    if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co',url) or not key:
        raise HTTPException(503,'User directory unavailable',headers=HEADERS)
    try:
        r = requests.request('GET' if body is None else 'POST',url+'/rest/v1/'+path,
            json=body,headers={'apikey':key,'Authorization':'Bearer '+key},timeout=(3,6))
        if not r.ok: raise ValueError('database unavailable')
        return r.json()
    except (requests.RequestException,ValueError):
        raise HTTPException(503,'User directory unavailable',headers=HEADERS) from None

def rpc(name,body): return db('rpc/'+name,body)

def clean(value,limit):
    return ''.join(c for c in str(value or '') if ord(c)>=32 and ord(c)!=127).strip()[:limit]

def register(user,profile):
    if not enabled(): return
    avatar = clean(profile.get('picture',''),2048)
    parsed = urlsplit(avatar)
    if parsed.scheme != 'https' or not parsed.hostname or not (parsed.hostname == 'googleusercontent.com' or parsed.hostname.endswith('.googleusercontent.com')):
        avatar = ''
    result = rpc('subnexa_users_login_v1',{'p_sub':user['sub'],'p_email':clean(user['email'],320).lower(),
        'p_name':clean(user.get('name'),200),'p_avatar':avatar})
    if result is not True: raise HTTPException(403,'Account blocked',headers=HEADERS)

def ping(request):
    from subnexa_auth import _user
    from subnexa_phase4_shared import check_shared, shared_enabled
    user = _user(request)  # authenticate before contacting limiter/database
    origin = request.headers.get('origin')
    known = {os.getenv('SUBNEXA_FRONTEND_URL','').rstrip('/'),'https://subnexa.lk','https://www.subnexa.lk',
             'https://eumf-subnexa.vercel.app','http://localhost:3000','http://127.0.0.1:3000'}
    if origin and origin not in known: raise HTTPException(403,'Untrusted origin',headers=HEADERS)
    if not enabled():
        try:
            from subnexa_presence import admit
            admit(user)
        except Exception: log.warning('Capacity heartbeat unavailable')
        return JSONResponse({'ok':True},headers=HEADERS)
    # Reuse distributed atomic limiter, per verified subject rather than shared proxy IP.
    if not shared_enabled(): raise HTTPException(503,'Presence rate limiter unavailable',headers=HEADERS)
    try: allowed = check_shared('/presence/ping', 'user:'+user['sub'])
    except Exception: raise HTTPException(503,'Presence temporarily unavailable',headers=HEADERS) from None
    if not allowed: raise HTTPException(429,'Too many heartbeats',headers={**HEADERS,'Retry-After':'60'})
    result = rpc('subnexa_users_ping_v1',{'p_sub':user['sub']})
    if result == 'blocked': raise HTTPException(403,'Account blocked',headers=HEADERS)
    if result == 'missing': return JSONResponse({'ok':False,'reauthenticate':True},headers=HEADERS)
    if result != 'ok': raise HTTPException(503,'Presence temporarily unavailable',headers=HEADERS)
    # Preserve the existing capacity lease without making UI depend on its availability.
    try:
        from subnexa_presence import admit
        admit(user)
    except Exception: log.warning('Capacity heartbeat unavailable')
    return JSONResponse({'ok':True},headers=HEADERS)

@router.post('/presence/ping')
def presence_ping(request: Request): return ping(request)

def require_admin(request):
    """Verify the existing Google-proof-issued signed admin session, password and revocation."""
    secret = os.getenv('SUBNEXA_ADMIN_BRIDGE_SECRET','')
    raw = request.cookies.get('subnexa_admin_v3','')
    if not raw and request.cookies.get('subnexa_session'):
        from subnexa_auth import _user_from_cookie_value
        signed = _user_from_cookie_value(request.cookies.get('subnexa_session'))
        emails = {e.strip().lower() for e in os.getenv('SUBNEXA_ADMIN_EMAILS','').split(',') if e.strip()}
        if signed and signed.get('email','').lower() not in emails:
            raise HTTPException(403,'Admin access denied',headers=HEADERS)
    if len(secret)<32: raise HTTPException(503,'Admin bridge unavailable',headers=HEADERS)
    if len(raw)>4096 or not re.fullmatch(r'[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',raw):
        raise HTTPException(401,'Unlock admin first',headers=HEADERS)
    body,sig=raw.split('.')
    expected=base64.urlsafe_b64encode(hmac.new(secret.encode(),('admin-session-v3.'+body).encode(),hashlib.sha256).digest()).decode().rstrip('=')
    if not hmac.compare_digest(expected,sig): raise HTTPException(401,'Invalid admin session',headers=HEADERS)
    try:
        data=json.loads(base64.urlsafe_b64decode(body+'='*(-len(body)%4)))
        now=int(time.time())
        if not isinstance(data,dict) or data.get('aud')!='subnexa-admin-session-v3' or not isinstance(data.get('sub'),str) or not data['sub'] or not isinstance(data.get('email'),str): raise ValueError()
        if type(data.get('exp')) is not int or not now<data['exp']<=now+900: raise ValueError()
        if not re.fullmatch(r'[0-9a-f-]{36}',data.get('jti','')): raise ValueError()
    except (ValueError,TypeError,KeyError): raise HTTPException(401,'Expired admin session',headers=HEADERS) from None
    allowed={e.strip().lower() for e in os.getenv('SUBNEXA_ADMIN_EMAILS','').split(',') if e.strip()}
    if data['email'].lower() not in allowed: raise HTTPException(403,'Admin access denied',headers=HEADERS)
    password=os.getenv('SUBNEXA_LIBRARY_ADMIN_KEY','')
    supplied=request.headers.get('x-library-admin-key','')
    if len(password)<12: raise HTTPException(503,'Admin password unavailable',headers=HEADERS)
    if not hmac.compare_digest(hashlib.sha256(password.encode()).digest(),hashlib.sha256(supplied.encode()).digest()):
        raise HTTPException(403,'Admin access denied',headers=HEADERS)
    digest=hashlib.sha256(('subnexa-admin-session-revoke-v1:'+data['jti']).encode()).hexdigest()
    rows=db('subnexa_admin_session_revocations?session_hash=eq.'+digest+'&select=session_hash&limit=1')
    if not isinstance(rows,list): raise HTTPException(503,'Revocation check unavailable',headers=HEADERS)
    if rows: raise HTTPException(401,'Admin session revoked',headers=HEADERS)
    if not enabled(): raise HTTPException(503,'User directory not enabled',headers=HEADERS)
    return data

@router.get('/admin/users/stats')
def stats(request: Request):
    require_admin(request)
    return JSONResponse(rpc('subnexa_users_stats_v1',{}),headers=HEADERS)

@router.get('/admin/users')
@router.get('/admin/users/online')
def users(request: Request, search: str=Query('',max_length=100),page: int=Query(1,ge=1,le=100000),page_size: int=Query(20,ge=1,le=50)):
    require_admin(request)
    if any(ord(c)<32 or ord(c)==127 for c in search): raise HTTPException(400,'Invalid search',headers=HEADERS)
    result=rpc('subnexa_users_list_v1',{'p_search':search.strip(),'p_page':page,'p_size':page_size,'p_online':request.url.path.endswith('/online')})
    return JSONResponse(result,headers=HEADERS)

class UsersNoStore:
    def __init__(self,app): self.app=app
    async def __call__(self,scope,receive,send):
        path=scope.get('path','')
        if scope.get('type')!='http' or not (path.startswith('/admin/users') or path in {'/presence/ping','/subnexa-auth/presence/ping'}):
            return await self.app(scope,receive,send)
        async def secure_send(message):
            if message['type']=='http.response.start':
                message=dict(message)
                headers=[(k,v) for k,v in message.get('headers',[]) if k.lower() not in {b'cache-control',b'x-content-type-options',b'referrer-policy'}]
                headers.extend((k.lower().encode(),v.encode()) for k,v in HEADERS.items())
                message['headers']=headers
            await send(message)
        return await self.app(scope,receive,secure_send)
