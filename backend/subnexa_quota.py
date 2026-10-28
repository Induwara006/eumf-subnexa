"""Project/model daily request estimates. No credentials in public snapshots."""
import hashlib
import json
import math
import os
import threading
import time
import uuid
from datetime import datetime, timedelta, time as daytime
from zoneinfo import ZoneInfo
from subnexa_usage import rpc, settings, emit

_cache = {}
_cache_lock = threading.Lock()
_uncertain = set()

class DailyQuotaExhausted(RuntimeError):
    category = 'rate_limit'
    code = 429


def configuration(model):
    from subnexa_account_pool import credentials
    keys = credentials('gemini')
    projects = json.loads(os.getenv('GEMINI_PROJECT_IDS_JSON', '[]'))
    if (not keys or not isinstance(projects, list) or len(projects) != len(keys)
            or any(not isinstance(p,str) or not p.strip() for p in projects)):
        raise RuntimeError('Configure GEMINI_PROJECT_IDS_JSON for every Gemini key.')
    limits = json.loads(os.getenv('GEMINI_PROJECT_LIMITS_JSON', '{}'))
    if not isinstance(limits,dict):
        raise RuntimeError('Invalid Gemini project limits.')
    result = {}
    for key, project in zip(keys, projects):
        project = project.strip()
        entry = limits.get(project, {}).get(model, {})
        rpd = entry.get('rpd')
        rpm = entry.get('rpm')
        if any(not isinstance(x,int) or isinstance(x,bool) or x < 1 for x in (rpd,rpm)):
            raise RuntimeError('Configure positive RPD/RPM for each project and model.')
        identity = hashlib.sha256(project.encode()).hexdigest()
        result[key] = {'project':identity, 'rpd':rpd, 'rpm':rpm}
    return result


def rate_config(key, model):
    return configuration(model)[key]


def invalidate():
    with _cache_lock:
        _cache.clear()


def now_pacific():
    return datetime.now(ZoneInfo('America/Los_Angeles'))


def reserve(key, model):
    c = configuration(model)[key]
    _,_,scope = settings()
    payload = {'p_event':str(uuid.uuid4()), 'p_scope':scope,
               'p_project':c['project'], 'p_model':model}
    # Mandatory durable reservation before each network attempt. If accounting is
    # unavailable, do not send an untracked paid request. Retries reuse this UUID.
    result = rpc('subnexa_quota_reserve_v1', payload)
    if result.get('allowed') is False:
        raise DailyQuotaExhausted('Daily project quota was previously exhausted.')
    if result.get('allowed') is not True or not isinstance(result.get('day'),str):
        raise RuntimeError('Request counter unavailable; translation progress is preserved.')
    invalidate()
    return dict(payload, day=result['day'])


def daily_error(error):
    # Do not classify generic 429, RetryInfo, token/minute, or error prose as daily.
    if getattr(error,'code',getattr(error,'status_code',None)) != 429:
        return False
    data = getattr(error,'response_json',None)
    if not isinstance(data,dict):
        return False
    body = data.get('error',data)
    if not isinstance(body,dict):
        return False
    details = body.get('details',[])
    if not isinstance(details,list):
        return False
    for detail in details:
        if not isinstance(detail,dict) or not str(detail.get('@type','')).endswith('QuotaFailure'):
            continue
        violations = detail.get('violations',[])
        if not isinstance(violations,list):
            continue
        for violation in violations:
            if not isinstance(violation,dict):
                continue
            quota_id = str(violation.get('quotaId','')).lower()
            if 'requestsperday' in quota_id:
                return True
    return False


def failure(error, attempt):
    if not attempt or not daily_error(error):
        return
    try:
        result = rpc('subnexa_quota_exhaust_v1', {
            'p_scope':attempt['p_scope'], 'p_project':attempt['p_project'],
            'p_model':attempt['p_model'], 'p_day':attempt['day']})
        if result.get('saved') is not True:
            raise RuntimeError('Unacknowledged quota status')
    except Exception:
        _uncertain.add((attempt['p_scope'],attempt['p_model'],attempt['day']))
    invalidate()


def snapshot(model):
    try:
        conf = configuration(model)
        _,_,scope = settings()
        distinct = {v['project']:v for v in conf.values()}
        cache_key = (scope,model,json.dumps(distinct,sort_keys=True),now_pacific().date().isoformat())
        # Coalesce simultaneous polling; keep the DB read bounded to one per 5s.
        with _cache_lock:
            cached = _cache.get(cache_key)
            if cached and time.monotonic()-cached[0] < 5:
                return dict(cached[1])
            data = rpc('subnexa_quota_snapshot_v1', {'p_scope':scope,'p_model':model,
                                                    'p_projects':list(distinct)})
            rows = data.get('rows')
            day = data.get('day')
            reset = data.get('reset_at')
            if not isinstance(rows,list) or not isinstance(day,str) or not isinstance(reset,str):
                raise RuntimeError('Invalid quota snapshot')
            by_project = {row['project']:row for row in rows}
            used = remaining = exhausted = 0
            for identity, c in distinct.items():
                row = by_project.get(identity, {'requests':0,'exhausted':False})
                n = row['requests']
                if not isinstance(n,int) or n < 0:
                    raise RuntimeError('Invalid counter')
                used += n
                exhausted += bool(row['exhausted'])
                remaining += 0 if row['exhausted'] else max(0,c['rpd']-n)
            total = sum(c['rpd'] for c in distinct.values())
            unknown = (scope,model,day) in _uncertain
            output = {'available':True,'estimated':True,'model':model,'projects':len(distinct),
                      'daily_limit':total,'requests_used':used,
                      'remaining':None if unknown else remaining,
                      'remaining_percent':None if unknown else round(100*remaining/total,1),
                      'exhausted_projects':exhausted,'day':day,'reset_at':reset}
            _cache.clear();_cache[cache_key]=(time.monotonic(),output)
            return dict(output)
    except Exception:
        return {'available':False,'remaining':None,'estimated':True}


def publish(model):
    emit('quota',snapshot(model))
