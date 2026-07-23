from __future__ import annotations

import logging
import os

from .config import (
    ai_settings,
    dashboard_settings,
    dry_run_enabled,
    email_summary_enabled,
    line_settings,
    load_accounts,
    load_rules,
)
from .dashboard import publish_dashboard
from .line import push_line
from .organizer import (
    build_service,
    format_priority_line_digest,
    format_result,
    mark_line_notified,
    organize_account,
    send_summary,
)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    accounts = load_accounts()
    rules = load_rules()
    dry_run = dry_run_enabled()
    email_summary = email_summary_enabled()
    lookback = os.environ.get("LOOKBACK", "1d")
    ai = ai_settings()
    line = line_settings()
    dashboard = dashboard_settings()
    failures: list[str] = []
    summaries: list[str] = []
    results = []

    for account in accounts:
        try:
            service = build_service(account)
            result = organize_account(
                service,
                account,
                rules,
                lookback,
                dry_run,
                ai=ai,
                exclude_line_notified=line is not None,
            )
            if email_summary:
                send_summary(service, account, result, dry_run)
            results.append(result)
            summaries.append(format_result(result, dry_run, account_email=account.email))
            logging.info("result:\n%s", format_result(result, dry_run))
        except Exception:
            failures.append(account.name)
            logging.exception("account=%s failed", account.name)
    if failures:
        raise SystemExit(f"Failed accounts: {', '.join(failures)}")
    if dashboard:
        publish_dashboard(dashboard, accounts, results, dry_run)
    if line:
        push_line(line, format_priority_line_digest(results, dry_run))
        if not dry_run:
            for account, result in zip(accounts, results, strict=True):
                mark_line_notified(build_service(account), result)


if __name__ == "__main__":
    main()
