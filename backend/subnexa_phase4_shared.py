"""Optional distributed rate limiting using atomic Supabase Postgres RPC.
Set SUBNEXA_SHARED_RATE_LIMIT=1 only after applying PHASE4_SHARED_RATE.sql.
Credentials are server-side and are never returned to clients.
"""
import asyncio
import hashlib
import hmac
import json
import os
from urllib.request import Request, urlopen
from urllib.error import HTTPError

LIMITS = {
    '/translate-srt-stream': 20, '/translate-srt': 20, '/translate': 20,
    '/upload': 30, '/translation/control': 60,
    '/subnexa-auth/login': 20, '/subnexa-auth/admin/handoff': 20,
}

def shared_enabled():
    return os.getenv('SUBNEXA_SHARED_RATE_LIMIT','0').strip().lower() in {'1','true','yes'}

def check_shared(path, ip):
    endpoint = os.getenv('SUPABASE_URL','').strip().rstrip('/')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY','').strip() or os.getenv('SUPABASE_SECRET_KEY','').strip()
    salt = os.getenv('SUBNEXA_RATE_HASH_SECRET','').strip()
    if not (endpoint.startswith('https://') and endpoint.endswith('.supabase.co') and key and len(salt)>=32):
        raise RuntimeError('Shared limiter missing secure Supabase environment configuration')
    digest = hmac.new(salt.encode(),ip.encode(),hashlib.sha256).hexdigest()
    body = json.dumps({'p_key':digest + ':' + hashlib.sha256(path.encode()).hexdigest()[:16],
                       'p_limit':LIMITS[path],'p_window_seconds':60}).encode()
    req = Request(endpoint+'/rest/v1/rpc/subnexa_phase4_rate_limit',data=body,
                  headers={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json'},method='POST')
    with urlopen(req,timeout=5) as response:
        result=json.loads(response.read(256))
    if not isinstance(result,bool):
        raise RuntimeError('Unexpected shared limiter reply')
    return result

class SharedRateGuard:
    def __init__(self,app): self.app=app
    async def __call__(self,scope,receive,send):
        if scope.get('type')!='http' or scope.get('method','GET').upper()=='OPTIONS' or not shared_enabled():
            return await self.app(scope,receive,send)
        path=scope.get('path','')
        if path not in LIMITS: return await self.app(scope,receive,send)
        # Never use untrusted forwarded headers. Use ASGI client's address only.
        client=scope.get('client')
        ip=str(client[0]) if client else 'unknown'
        try:
            allowed=await asyncio.to_thread(check_shared,path,ip)
        except Exception:
            return await self.reject(send,503,'Rate limiter temporarily unavailable.')
        if not allowed: return await self.reject(send,429,'Too many requests. Retry shortly.')
        return await self.app(scope,receive,send)
    @staticmethod
    async def reject(send,status,detail):
        headers=[(b'content-type',b'application/json'),(b'cache-control',b'no-store')]
        if status==429:headers.append((b'retry-after',b'60'))
        body=json.dumps({'detail':detail}).encode()
        await send({'type':'http.response.start','status':status,'headers':headers})
        await send({'type':'http.response.body','body':body})
