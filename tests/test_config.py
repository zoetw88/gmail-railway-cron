import json

import pytest

from gmail_cron.config import ai_settings, dashboard_settings, email_summary_enabled, line_settings, load_accounts


def test_load_accounts(monkeypatch):
    value = [{"name":"A","email":"a@example.com","client_id":"id","client_secret":"secret","refresh_token":"token"}]
    monkeypatch.setenv("GMAIL_ACCOUNTS_JSON", json.dumps(value))
    assert load_accounts()[0].email == "a@example.com"


def test_duplicate_account_names_are_rejected(monkeypatch):
    account = {"name":"A","email":"a@example.com","client_id":"id","client_secret":"secret","refresh_token":"token"}
    monkeypatch.setenv("GMAIL_ACCOUNTS_JSON", json.dumps([account, account]))
    with pytest.raises(ValueError, match="unique"):
        load_accounts()


def test_ai_requires_key_and_positive_limit(monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "true")
    with pytest.raises(ValueError, match="AI_API_KEY"):
        ai_settings()
    monkeypatch.setenv("GLM_API_KEY", "secret")
    monkeypatch.setenv("AI_MAX_MESSAGES", "0")
    with pytest.raises(ValueError, match="greater than 0"):
        ai_settings()


def test_provider_neutral_ai_settings_override_glm(monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "true")
    monkeypatch.setenv("AI_API_KEY", "openrouter-secret")
    monkeypatch.setenv("AI_BASE_URL", "https://openrouter.ai/api/v1/")
    monkeypatch.setenv("AI_MODEL", "openai/gpt-4o")

    settings = ai_settings()

    assert settings.api_key == "openrouter-secret"
    assert settings.base_url == "https://openrouter.ai/api/v1"
    assert settings.model == "openai/gpt-4o"


def test_line_user_id_is_validated(monkeypatch):
    monkeypatch.setenv("LINE_ENABLED", "true")
    monkeypatch.setenv("LINE_CHANNEL_ACCESS_TOKEN", "secret")
    monkeypatch.setenv("LINE_USER_ID", "not-a-user-id")
    with pytest.raises(ValueError, match="LINE_USER_ID"):
        line_settings()


def test_email_summary_can_be_disabled(monkeypatch):
    monkeypatch.setenv("EMAIL_SUMMARY_ENABLED", "false")
    assert email_summary_enabled() is False


def test_dashboard_requires_https_and_token(monkeypatch):
    monkeypatch.setenv("DASHBOARD_ENABLED", "true")
    monkeypatch.setenv("DASHBOARD_URL", "http://example.test")
    with pytest.raises(ValueError, match="https"):
        dashboard_settings()

    monkeypatch.setenv("DASHBOARD_URL", "https://example.test/")
    monkeypatch.setenv("DASHBOARD_INGEST_TOKEN", "secret")
    monkeypatch.setenv("DASHBOARD_ACCESS_TOKEN", "access-secret")
    assert dashboard_settings().url == "https://example.test"
