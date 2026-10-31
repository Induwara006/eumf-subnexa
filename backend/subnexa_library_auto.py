"""Publish fully translated output using a server-verified Google identity.

Called only from the completed translation branch, never from browser-provided
subtitle/author fields. Storage is private; public reads use the existing proxy.
"""
from __future__ import annotations
import hashlib
import json
import os
import re
import time
import unicodedata
import uuid
from urllib.parse import urlsplit

BUCKET = 'subnexa-library'
MAX_BYTES = 2 * 1024 * 1024


def config():
    url = os.getenv('SUPABASE_URL', '').strip().rstrip('/')
    key = (os.getenv('SUPABASE_SECRET_KEY', '').strip()
           or os.getenv('SUPABASE_SERVICE_ROLE_KEY', '').strip())
    parsed = urlsplit(url)
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.path
            or parsed.query or parsed.fragment or parsed.username or parsed.password):
        raise RuntimeError('Invalid library configuration')
    if not key or key.startswith('sb_publishable_'):
        raise RuntimeError('Missing library server key')
    headers = {'apikey': key}
    if not key.startswith('sb_secret_'):
        headers['Authorization'] = 'Bearer ' + key
    return url, headers


def clean_text(value, maximum):
    if not isinstance(value, str):
        return ''
    value = ''.join(c for c in value if not unicodedata.category(c).startswith('C'))
    return ' '.join(value.split())[:maximum].strip()


def title_from_filename(filename):
    try:
        from subnexa_title_clean import library_title
        cleaned = library_title(filename)
        if cleaned[0]:
            return cleaned
    except Exception:
        pass  # fall back to the original logic below
    leaf = re.split(r'[/\\]', filename or '')[-1]
    leaf = re.sub(r'\.(srt|ass)$', '', leaf, flags=re.I)
    year_match = re.search(r'(?<!\d)((?:19|20)\d{2})(?!\d)', leaf)
    year = year_match.group(1) if year_match else ''
    title = clean_text(re.sub(r'[._]+', ' ', leaf), 120) or 'Translated subtitles'
    return title, year


def item_id(owner, job_id, output_format, opening_credit):
    identity = json.dumps([owner, job_id, output_format, bool(opening_credit)],
                          ensure_ascii=True, separators=(',', ':'))
    # This identity is stable for retries, excludes display name/filename and
    # separates owners and output options. Raw user IDs are not stored or exposed.
    return str(uuid.uuid5(uuid.NAMESPACE_URL, 'subnexa:auto-library:v1:' + identity))


def request(method, path, *, data=None, payload=None, headers=None, accepted=(200,201,204)):
    import requests
    url, auth = config()
    auth.update(headers or {})
    for attempt in range(2):
        try:
            with requests.request(method, url + path, headers=auth, data=data,
                                  json=payload, timeout=(3, 8), allow_redirects=False,
                                  stream=True) as response:
                status = response.status_code
                # Read a bounded response; no error content is logged or returned.
                chunks=[];size=0
                for chunk in response.iter_content(65536):
                    size += len(chunk)
                    if size > MAX_BYTES + 65536:
                        raise RuntimeError('Library response too large')
                    chunks.append(chunk)
                body=b''.join(chunks)
                if status in accepted:
                    return status, body
                if status not in (429,500,502,503,504):
                    raise RuntimeError('Library request rejected')
        except requests.RequestException:
            pass
        if attempt == 0:
            time.sleep(0.2)
    raise RuntimeError('Library temporarily unavailable')


def existing(identity):
    _, raw = request('GET', '/rest/v1/subnexa_library_items?id=eq.' + identity
                     + '&select=id,translated_by&limit=1')
    rows = json.loads(raw)
    if not isinstance(rows, list):
        raise RuntimeError('Invalid library response')
    if not rows:
        return None
    if not isinstance(rows[0],dict) or rows[0].get('id') != identity:
        raise RuntimeError('Invalid library item')
    return rows[0]


def publish_completed(*, user, job_id, original_filename, content, output_format,
                      opening_credit=False, completed, total):
    """Return a small status dict; publication errors must not lose the download."""
    if (not isinstance(user,dict) or not isinstance(user.get('sub'),str)
            or not user['sub'].strip()):
        return {'saved':False, 'reason':'sign_in_required'}
    if total <= 0 or completed != total:
        return {'saved':False, 'reason':'incomplete'}
    if output_format not in ('srt','ass') or not isinstance(content,str):
        return {'saved':False, 'reason':'invalid_output'}
    body=content.encode('utf-8')
    if not body or len(body) > MAX_BYTES:
        return {'saved':False, 'reason':'size_limit'}
    if (output_format=='srt' and '-->' not in content) or (output_format=='ass' and '[Events]' not in content):
        return {'saved':False, 'reason':'invalid_output'}
    from subnexa_profile import record_completed
    record_completed(user, job_id)
    name=clean_text(user.get('name'),120) or 'SubNexa user'
    identity=item_id(user['sub'],job_id,output_format,opening_credit)
    try:
        prior=existing(identity)
        if prior:
            return {'saved':True,'id':identity,'translated_by':prior.get('translated_by') or name,'already_exists':True}
        path=f'{identity}/subtitle.{output_format}'
        status, _ = request('POST', f'/storage/v1/object/{BUCKET}/{path}', data=body,
                            headers={'Content-Type':'text/plain; charset=utf-8','x-upsert':'false'},
                            accepted=(200,201,400,409))
        if status in (400,409):
            # Another worker or an earlier timed-out upload may already own this
            # path. Verify exact bytes; do not overwrite a published subtitle.
            _, stored=request('GET', f'/storage/v1/object/authenticated/{BUCKET}/{path}')
            if hashlib.sha256(stored).digest()!=hashlib.sha256(body).digest():
                prior=existing(identity)
                if prior:
                    return {'saved':True,'id':identity,'translated_by':prior.get('translated_by') or name,'already_exists':True}
                raise RuntimeError('Conflicting unpublished library object')
        title,year=title_from_filename(original_filename)
        row={'id':identity,'title':title,'year':year,'language':'Sinhala','format':output_format,
             'poster_type':'','downloads':0,'translated_by':name}
        request('POST','/rest/v1/subnexa_library_items?on_conflict=id',payload=row,
                headers={'Content-Type':'application/json','Prefer':'resolution=ignore-duplicates,return=minimal'})
        # Verify a timed-out/conflicting INSERT and retain original attribution.
        prior=existing(identity)
        if not prior:
            raise RuntimeError('Library publication not confirmed')
        # Best effort: attach a TMDB poster in the background. A missing poster
        # must never block or fail publication.
        try:
            from subnexa_library_poster import attach_poster_async
            try:
                from subnexa_title_clean import parse_release
                parsed = parse_release(title)
                poster_title, is_series = parsed['title'], bool(parsed['episode'])
            except Exception:
                poster_title, is_series = title, False
            attach_poster_async(identity, poster_title, year, is_series)
        except Exception:
            pass
        return {'saved':True,'id':identity,'translated_by':prior.get('translated_by') or name,'already_exists':False}
    except Exception as error:
        # Retain private uploaded bytes after ambiguous DB errors so a later retry
        # can complete the same entry without deleting a successful concurrent save.
        print('[SubNexa Library] auto-save unavailable: '+type(error).__name__, flush=True)
        return {'saved':False,'reason':'library_unavailable'}
