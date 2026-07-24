# Gmail A/B/C/D Daily Organizer

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/gmail-ai-daily-organizer)

A Railway Cron job that organizes multiple Gmail accounts, applies first-match rules, archives clear promotions, and sends a daily summary.

[Deployment guide](docs/DEPLOYMENT.md) · [Security & privacy](docs/SECURITY.md)

## Highlights

- Multi-account Gmail processing
- Deterministic, top-to-bottom rules in `rules.json`
- Optional OpenRouter or GLM classification suggestions
- Optional LINE summary notifications
- Optional private Inbox Daily dashboard
- Dry-run first; no delete, reply, unsubscribe, or automatic applications
- Runs on Railway and exits after each scheduled job

## Quick start

```powershell
python -m pip install -e '.[test]'
pytest -q
```

For local configuration, copy `.env.example` and keep secrets outside Git. For Railway deployment, follow the [deployment guide](docs/DEPLOYMENT.md).

## How it works

1. Scan recent Inbox messages for each configured account.
2. Apply the first matching rule from `rules.json`.
3. Archive only messages explicitly marked with `archive: true`.
4. Send an email, LINE, or dashboard summary when enabled.
5. Exit with a non-zero status if an account fails.

## Configuration

- Gmail accounts: `GMAIL_ACCOUNTS_JSON`
- Safety: `DRY_RUN=true`
- Lookback window: `LOOKBACK=1d`
- AI: `AI_ENABLED=false` by default
- Notifications: `EMAIL_SUMMARY_ENABLED`, `LINE_ENABLED`
- Dashboard: `DASHBOARD_ENABLED`

## Repository map

- `src/gmail_cron/` — application code
- `rules.json` — ordered classification and archive rules
- `dashboard/` — optional private dashboard
- `manual-runner/` — manual execution helpers
- `tests/` — automated tests
- `docs/` — deployment and security guides

## Development

```powershell
python -m pip install -e '.[test]'
pytest -q
```

MIT License
