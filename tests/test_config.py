import json

import pytest

from gmail_cron.config import ai_settings, line_settings, load_accounts


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
    with pytest.raises(ValueError, match="GLM_API_KEY"):
        ai_settings()
    monkeypatch.setenv("GLM_API_KEY", "secret")
    monkeypatch.setenv("AI_MAX_MESSAGES", "0")
    with pytest.raises(ValueError, match="greater than 0"):
        ai_settings()


def test_line_user_id_is_validated(monkeypatch):
    monkeypatch.setenv("LINE_ENABLED", "true")
    monkeypatch.setenv("LINE_CHANNEL_ACCESS_TOKEN", "secret")
    monkeypatch.setenv("LINE_USER_ID", "not-a-user-id")
    with pytest.raises(ValueError, match="LINE_USER_ID"):
        line_settings()
