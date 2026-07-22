import json

import pytest

from gmail_cron.config import load_accounts


def test_load_accounts(monkeypatch):
    value = [{"name":"A","email":"a@example.com","client_id":"id","client_secret":"secret","refresh_token":"token"}]
    monkeypatch.setenv("GMAIL_ACCOUNTS_JSON", json.dumps(value))
    assert load_accounts()[0].email == "a@example.com"


def test_duplicate_account_names_are_rejected(monkeypatch):
    account = {"name":"A","email":"a@example.com","client_id":"id","client_secret":"secret","refresh_token":"token"}
    monkeypatch.setenv("GMAIL_ACCOUNTS_JSON", json.dumps([account, account]))
    with pytest.raises(ValueError, match="unique"):
        load_accounts()

