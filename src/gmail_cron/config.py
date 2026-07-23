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


@dataclass(frozen=True)
class AiSettings:
    api_key: str
    base_url: str
    model: str
    confidence_threshold: float
    max_messages: int
    apply_labels: bool


@dataclass(frozen=True)
class LineSettings:
    channel_access_token: str
    user_id: str


@dataclass(frozen=True)
class DashboardSettings:
    url: str
    ingest_token: str


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


def email_summary_enabled() -> bool:
    return os.environ.get("EMAIL_SUMMARY_ENABLED", "true").lower() in {"1", "true", "yes"}


def ai_settings() -> AiSettings | None:
    if os.environ.get("AI_ENABLED", "false").lower() not in {"1", "true", "yes"}:
        return None
    api_key = os.environ.get("AI_API_KEY") or os.environ.get("GLM_API_KEY", "")
    if not api_key:
        raise ValueError("AI_API_KEY or GLM_API_KEY is required when AI_ENABLED=true")
    threshold = float(os.environ.get("AI_CONFIDENCE_THRESHOLD", "0.90"))
    if not 0 <= threshold <= 1:
        raise ValueError("AI_CONFIDENCE_THRESHOLD must be between 0 and 1")
    max_messages = int(os.environ.get("AI_MAX_MESSAGES", "20"))
    if max_messages <= 0:
        raise ValueError("AI_MAX_MESSAGES must be greater than 0")
    return AiSettings(
        api_key=api_key,
        base_url=os.environ.get("AI_BASE_URL", os.environ.get("GLM_BASE_URL", "https://api.z.ai/api/paas/v4")).rstrip("/"),
        model=os.environ.get("AI_MODEL", os.environ.get("GLM_MODEL", "glm-4.7-flashx")),
        confidence_threshold=threshold,
        max_messages=max_messages,
        apply_labels=os.environ.get("AI_APPLY_LABELS", "false").lower() in {"1", "true", "yes"},
    )


def line_settings() -> LineSettings | None:
    if os.environ.get("LINE_ENABLED", "false").lower() not in {"1", "true", "yes"}:
        return None
    token = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN", "")
    user_id = os.environ.get("LINE_USER_ID", "")
    if not token or not user_id:
        raise ValueError("LINE_CHANNEL_ACCESS_TOKEN and LINE_USER_ID are required when LINE_ENABLED=true")
    if not user_id.startswith("U") or len(user_id) != 33:
        raise ValueError("LINE_USER_ID must look like U followed by 32 characters")
    return LineSettings(channel_access_token=token, user_id=user_id)


def dashboard_settings() -> DashboardSettings | None:
    if os.environ.get("DASHBOARD_ENABLED", "false").lower() not in {"1", "true", "yes"}:
        return None
    url = os.environ.get("DASHBOARD_URL", "").rstrip("/")
    token = os.environ.get("DASHBOARD_INGEST_TOKEN", "")
    if not url.startswith("https://") or not token:
        raise ValueError("DASHBOARD_URL (https) and DASHBOARD_INGEST_TOKEN are required")
    return DashboardSettings(url=url, ingest_token=token)
