# Deployment

## Railway

Use the **Deploy on Railway** button in the root README, then set:

- `GMAIL_ACCOUNTS_JSON`
- `DRY_RUN=true`
- `LOOKBACK=1d`
- `EMAIL_SUMMARY_ENABLED=true`

The scheduled job runs at `30 13 * * *` UTC (21:30 Taiwan time) and exits after each run.

Always run the job manually first. Review the logs and matching counts for every account. Only change `DRY_RUN=false` after the rules are verified.

## Google Cloud OAuth

1. Enable the Gmail API.
2. Configure the OAuth consent screen and test users.
3. Create a Desktop app OAuth client.
4. Authorize each account with `gmail.modify` and `gmail.send`.
5. Store the resulting account data in `GMAIL_ACCOUNTS_JSON`.

See `.env.example` for the expected shape.
