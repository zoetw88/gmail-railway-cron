from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Account:
    name: str
    email: str
    client_id: str
    client_secret: str
    refresh_token: str


@dataclass(frozen=True)
class Rule:
    label: str
    query: str
    archive: bool = False


def load_accounts() -> list[Account]:
    raw = os.environ.get("GMAIL_ACCOUNTS_JSON")
    if not raw:
        raise ValueError("GMAIL_ACCOUNTS_JSON is required")
    values = json.loads(raw)
    if not isinstance(values, list) or not values:
        raise ValueError("GMAIL_ACCOUNTS_JSON must be a non-empty JSON array")
    accounts = [Account(**value) for value in values]
    names = [account.name for account in accounts]
    if len(names) != len(set(names)):
        raise ValueError("account names must be unique")
    return accounts


def load_rules(path: str | None = None) -> list[Rule]:
    rule_path = Path(path or os.environ.get("RULES_PATH", "rules.json"))
    values = json.loads(rule_path.read_text(encoding="utf-8"))
    return [Rule(**value) for value in values]


def dry_run_enabled() -> bool:
    return os.environ.get("DRY_RUN", "true").lower() not in {"0", "false", "no"}

