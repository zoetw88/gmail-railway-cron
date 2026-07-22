# Repository guidance

- Runtime: Python 3.12, entrypoint `python -m gmail_cron` with `PYTHONPATH=src`.
- Run tests with `pytest -q` after installing `.[test]`.
- Gmail writes must retain a dry-run path; never commit OAuth credentials, refresh tokens, or `.env` files.
- `domain`-style rule data remains independent from Gmail API transport code.
- Deployment target is a short-lived Railway Cron service that must exit after each run.
