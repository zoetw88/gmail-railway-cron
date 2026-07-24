# Security and privacy

## Safe defaults

- `DRY_RUN=true` by default.
- No delete, reply, unsubscribe, or automatic AI archiving.
- Only recent Inbox messages are scanned.
- Unmatched messages stay in the Inbox.
- OAuth secrets and refresh tokens belong in Railway Variables, never in Git.
- AI is opt-in and receives only the sender, subject, and up to 500 characters of snippet.
- Logs contain account aliases, categories, and counts—not tokens or message IDs.

## Optional integrations

- OpenRouter/GLM: classification suggestions; GLM receives limited message metadata.
- LINE Messaging API: summary categories and short AI summaries.
- Dashboard: stores selected summary fields for the last 30 days.

Disable the corresponding environment variable to stop an integration. Revoke Google OAuth tokens to stop Gmail access. Delete the Railway service to remove its stored variables.

Before enabling any write behavior, test with `DRY_RUN=true` and inspect the logs.
