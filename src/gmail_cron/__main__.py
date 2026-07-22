from __future__ import annotations

import json
import logging
import os

from .config import dry_run_enabled, load_accounts, load_rules
from .organizer import build_service, organize_account, send_summary


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    accounts = load_accounts()
    rules = load_rules()
    dry_run = dry_run_enabled()
    lookback = os.environ.get("LOOKBACK", "1d")
    failures: list[str] = []

    for account in accounts:
        try:
            service = build_service(account)
            result = organize_account(service, account, rules, lookback, dry_run)
            send_summary(service, account, result, dry_run)
            logging.info("result=%s", json.dumps(result.__dict__, ensure_ascii=False))
        except Exception:
            failures.append(account.name)
            logging.exception("account=%s failed", account.name)
    if failures:
        raise SystemExit(f"Failed accounts: {', '.join(failures)}")


if __name__ == "__main__":
    main()

