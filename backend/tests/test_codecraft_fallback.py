"""Offline tests; use: python -m pytest -q tests/test_codecraft_fallback.py"""
import json
import types
import pytest
import codecraft_fallback as cc
import translator

@pytest.fixture(autouse=True)
def env(monkeypatch):
    monkeypatch.setenv('CODECRAFT_API_KEY','TEST_DUMMY_DO_NOT_USE')
    monkeypatch.setenv('CODECRAFT_FALLBACK_ENABLED','true')
    monkeypatch.setenv('CODECRAFT_MODEL',cc.DEFAULT_MODEL)


def primary(result=None, error=None):
    class Models:
        def generate_content(self, **kwargs):
            if error:
                raise error
            return types.SimpleNamespace(text=result)
    return types.SimpleNamespace(models=Models())


def test_primary_success_never_calls_backup(monkeypatch):
    monkeypatch.setattr(translator,'codecraft_generate_array',lambda *a: pytest.fail('backup called on success'))
    assert translator._generate_array(primary('["සිංහල"]'),'test',1) == ['සිංහල']


def test_primary_outage_uses_backup(monkeypatch):
    monkeypatch.setattr(translator,'codecraft_generate_array',lambda p,n: ['ආයුබෝවන්'])
    assert translator._generate_array(primary(error=RuntimeError('503 UNAVAILABLE')),'test',1)==['ආයුබෝවන්']


def test_primary_rate_limit_uses_backup(monkeypatch):
    monkeypatch.setattr(translator,'codecraft_generate_array',lambda p,n: ['ආයුබෝවන්'])
    assert translator._generate_array(primary(error=RuntimeError('429 RESOURCE_EXHAUSTED')),'test',1)==['ආයුබෝවන්']


def test_no_fallback_on_invalid_key(monkeypatch):
    monkeypatch.setattr(translator,'codecraft_generate_array',lambda *a: pytest.fail('backup should not run'))
    with pytest.raises(RuntimeError,match='401'):
        translator._generate_array(primary(error=RuntimeError('401 UNAUTHENTICATED')),'test',1)


def test_no_fallback_when_disabled(monkeypatch):
    monkeypatch.setenv('CODECRAFT_FALLBACK_ENABLED','false')
    monkeypatch.setattr(translator,'codecraft_generate_array',lambda *a: pytest.fail('backup should not run'))
    with pytest.raises(RuntimeError, match='503'):
        translator._generate_array(primary(error=RuntimeError('503 UNAVAILABLE')),'test',1)


def test_codecraft_count_mismatch(monkeypatch):
    monkeypatch.setattr(cc,'_request',lambda *a,**kw: {'choices':[{'message':{'content':'["එකක්"]'},'finish_reason':'stop'}]})
    with pytest.raises(ValueError,match='count mismatch'):
        cc.generate_array('test',2)


def test_codecraft_protects_placeholders_in_prompt(monkeypatch):
    calls=[]
    def fake_request(path,*,body=None):
        calls.append((path,body))
        return {'choices':[{'message':{'content':'["[[SNX_0001]] එක"]'},'finish_reason':'stop'}]}
    monkeypatch.setattr(cc,'_request',fake_request)
    result=cc.generate_array('Translate [[SNX_0001]]',1)
    assert result==['[[SNX_0001]] එක']
    assert calls[0][1]['messages'][1]['content']=='Translate [[SNX_0001]]'
    assert calls[0][1]['model']==cc.DEFAULT_MODEL


def test_model_list_parses(monkeypatch):
    monkeypatch.setattr(cc,'_request', lambda path: {'data':[{'id':cc.DEFAULT_MODEL}]})
    assert cc.list_models()[0]['id']==cc.DEFAULT_MODEL


def test_no_key_no_fallback(monkeypatch):
    monkeypatch.delenv('CODECRAFT_API_KEY')
    monkeypatch.delenv('BACKUP_API_KEY',raising=False)
    assert not cc.enabled()
    assert not cc.should_fallback(RuntimeError('503 UNAVAILABLE'))
