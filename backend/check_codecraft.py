"""Run from backend: python check_codecraft.py  (never prints your API key)."""
from dotenv import load_dotenv
load_dotenv()
from codecraft_fallback import DEFAULT_MODEL, enabled, list_models

if not enabled():
    print('CodeCraft key not found. Add CODECRAFT_API_KEY to backend/.env')
else:
    try:
        models = list_models()
        ids = [m.get('id') for m in models]
        print('CodeCraft authentication: OK')
        print('Available model count:', len(ids))
        print('Selected model available:', DEFAULT_MODEL in ids)
        if DEFAULT_MODEL not in ids:
            print('Gemini options:', [i for i in ids if isinstance(i,str) and 'gemini' in i.lower()])
            print('Set CODECRAFT_MODEL to a listed model ID in backend/.env')
    except Exception as exc:
        print('CodeCraft check failed:', exc)
