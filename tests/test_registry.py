"""Tests for the model registry contents (2026-07 refresh)."""

from __future__ import annotations

from mira.llm import registry


class TestMiniMaxInRegistry:
    """MiniMax M3 must be registered and usable for both indexing and review."""

    def test_minimax_in_all_models(self):
        assert "minimax/minimax-m3" in registry.all_models()

    def test_minimax_entry_structure(self):
        info = registry.get("minimax/minimax-m3")
        assert info["label"] == "MiniMax M3"
        assert info["provider"] == "minimax"
        assert info["max_input_tokens"] == 1048576
        assert info["max_output_tokens"] == 512000
        assert info["supports_json_mode"] is True

    def test_minimax_supports_indexing(self):
        assert registry.is_supported("minimax/minimax-m3", purpose="indexing")

    def test_minimax_supports_review(self):
        assert registry.is_supported("minimax/minimax-m3", purpose="review")

    def test_minimax_in_indexing_models_list(self):
        indexing = registry.models_for_purpose("indexing")
        values = [m["value"] for m in indexing]
        assert "minimax/minimax-m3" in values

    def test_minimax_in_review_models_list(self):
        review = registry.models_for_purpose("review")
        values = [m["value"] for m in review]
        assert "minimax/minimax-m3" in values

    def test_minimax_pricing(self):
        inp, out = registry.pricing("minimax/minimax-m3")
        assert inp == 0.30
        assert out == 1.20

    def test_minimax_max_output_tokens(self):
        assert registry.max_output_tokens("minimax/minimax-m3") == 512000


class TestRegistryRegression:
    """The eval-validated defaults and current-gen additions must be present."""

    def test_recommended_defaults_still_present(self):
        assert "anthropic/claude-sonnet-4-6" in registry.all_models()
        assert "anthropic/claude-haiku-4-5" in registry.all_models()

    def test_current_gen_indexing_models(self):
        indexing = registry.models_for_purpose("indexing")
        values = [m["value"] for m in indexing]
        assert "google/gemini-3.1-flash-lite" in values
        assert "openai/gpt-5-mini" in values
        assert "deepseek/deepseek-v4-flash" in values

    def test_current_gen_review_models(self):
        review = registry.models_for_purpose("review")
        values = [m["value"] for m in review]
        assert "anthropic/claude-sonnet-4-6" in values
        assert "anthropic/claude-sonnet-5" in values
        assert "anthropic/claude-opus-4-8" in values
        assert "anthropic/claude-fable-5" in values
        assert "openai/gpt-5.2" in values
        assert "deepseek/deepseek-v4-pro" in values

    def test_recommended_flags_unchanged(self):
        # Recommended stays on the eval-validated pair until benchmarks say
        # otherwise (v10 baseline was measured on Sonnet 4.6 / Haiku 4.5).
        review = {m["value"]: m["recommended"] for m in registry.models_for_purpose("review")}
        indexing = {m["value"]: m["recommended"] for m in registry.models_for_purpose("indexing")}
        assert review["anthropic/claude-sonnet-4-6"] is True
        assert review["anthropic/claude-sonnet-5"] is False
        assert indexing["anthropic/claude-haiku-4-5"] is True
