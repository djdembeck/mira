"""Provider-aware model dropdowns: endpoint detection, live OpenRouter list,
and option filtering."""

from __future__ import annotations

import pytest

from mira.config import LLMConfig
from mira.dashboard import models_config
from mira.dashboard.models_config import (
    detect_provider,
    openrouter_model_ids,
    options_for_provider,
)

OPTS = [
    {"value": "anthropic/claude-haiku-4-5", "label": "Claude Haiku 4.5", "recommended": True},
    {
        "value": "us.anthropic.claude-haiku-4-5-v1:0",
        "label": "Haiku (Bedrock)",
        "recommended": True,
    },
    {"value": "openai/gpt-4o-mini", "label": "GPT-4o mini", "recommended": False},
]


@pytest.fixture(autouse=True)
def _clear_openrouter_cache():
    models_config._openrouter_cache = None
    yield
    models_config._openrouter_cache = None


def test_detect_provider():
    assert detect_provider(LLMConfig(provider="bedrock")) == "bedrock"
    assert detect_provider(LLMConfig()) == "openrouter"  # default base_url
    assert detect_provider(LLMConfig(base_url="http://localhost:11434/v1")) == "generic"


def test_bedrock_keeps_only_bedrock_ids():
    out = options_for_provider(OPTS, "bedrock")
    assert [o["value"] for o in out] == ["us.anthropic.claude-haiku-4-5-v1:0"]


def test_generic_keeps_slash_ids():
    out = options_for_provider(OPTS, "generic")
    assert [o["value"] for o in out] == ["anthropic/claude-haiku-4-5", "openai/gpt-4o-mini"]


def test_openrouter_filters_by_live_list():
    live = frozenset({"anthropic/claude-haiku-4-5"})
    out = options_for_provider(OPTS, "openrouter", live)
    assert [o["value"] for o in out] == ["anthropic/claude-haiku-4-5"]


def test_openrouter_matches_dot_dash_and_case_aliases():
    # OpenRouter lists lowercase dot ids (claude-haiku-4.5, minimax-m2.7); the
    # registry's dash/mixed-case forms are accepted aliases and must survive.
    opts = OPTS + [{"value": "minimax/MiniMax-M2.7", "label": "MiniMax M2.7", "recommended": False}]
    live = frozenset({"anthropic/claude-haiku-4.5", "minimax/minimax-m2.7"})
    out = options_for_provider(opts, "openrouter", live)
    assert [o["value"] for o in out] == ["anthropic/claude-haiku-4-5", "minimax/MiniMax-M2.7"]


def test_openrouter_without_live_list_keeps_slash_ids():
    out = options_for_provider(OPTS, "openrouter", None)
    assert [o["value"] for o in out] == ["anthropic/claude-haiku-4-5", "openai/gpt-4o-mini"]


def test_filter_never_returns_empty():
    live = frozenset({"some/other-model"})
    assert options_for_provider(OPTS, "openrouter", live) == OPTS


class _Resp:
    def __init__(self, ids):
        self._ids = ids

    def raise_for_status(self):
        pass

    def json(self):
        return {"data": [{"id": i} for i in self._ids]}


def test_openrouter_fetch_caches(monkeypatch: pytest.MonkeyPatch):
    calls = []

    def fake_get(url, timeout):
        calls.append(url)
        return _Resp(["a/x", "b/y"])

    monkeypatch.setattr(models_config.httpx, "get", fake_get)
    assert openrouter_model_ids() == frozenset({"a/x", "b/y"})
    assert openrouter_model_ids() == frozenset({"a/x", "b/y"})
    assert len(calls) == 1


def test_openrouter_fetch_failure_returns_none(monkeypatch: pytest.MonkeyPatch):
    def fake_get(url, timeout):
        raise OSError("network down")

    monkeypatch.setattr(models_config.httpx, "get", fake_get)
    assert openrouter_model_ids() is None


def test_openrouter_fetch_failure_returns_stale_cache(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(models_config.httpx, "get", lambda url, timeout: _Resp(["a/x"]))
    assert openrouter_model_ids() == frozenset({"a/x"})

    # Expire the TTL, then fail the refresh — stale ids beat an empty dropdown.
    ts, ids = models_config._openrouter_cache
    models_config._openrouter_cache = (ts - 7200, ids)

    def fail(url, timeout):
        raise OSError("network down")

    monkeypatch.setattr(models_config.httpx, "get", fail)
    assert openrouter_model_ids() == frozenset({"a/x"})


def test_set_models_accepts_live_off_registry_id(monkeypatch: pytest.MonkeyPatch):
    from mira.dashboard import api
    from mira.dashboard.db import AppDatabase

    monkeypatch.setattr(api, "_app_db", AppDatabase(url="", admin_password="admin"))
    monkeypatch.setattr(models_config, "detect_provider", lambda llm: "openrouter")
    monkeypatch.setattr(
        models_config,
        "openrouter_model_ids",
        lambda: frozenset({"newvendor/shiny-model"}),
    )

    body = api.ModelsUpdate(
        indexing_model="anthropic/claude-haiku-4-5",
        review_model="newvendor/shiny-model",
    )
    assert api.set_models(body) == {"ok": True}


def test_set_models_rejects_unknown_id(monkeypatch: pytest.MonkeyPatch):
    from fastapi import HTTPException

    from mira.dashboard import api
    from mira.dashboard.db import AppDatabase

    monkeypatch.setattr(api, "_app_db", AppDatabase(url="", admin_password="admin"))
    monkeypatch.setattr(models_config, "detect_provider", lambda llm: "openrouter")
    monkeypatch.setattr(models_config, "openrouter_model_ids", lambda: frozenset())

    body = api.ModelsUpdate(
        indexing_model="anthropic/claude-haiku-4-5",
        review_model="madeup/not-a-model",
    )
    with pytest.raises(HTTPException) as exc:
        api.set_models(body)
    assert exc.value.status_code == 400
