import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";
import { bindings, type DigestRun, initializeDatabase } from "./digests";

type StoredSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function gmailThreadUrl(email: string, threadId: string) {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(email)}#all/${encodeURIComponent(threadId)}`;
}

export async function sendUrgentPushes(run: DigestRun) {
  if (run.dryRun) return;
  const urgent = run.accounts.flatMap((account) =>
    account.aiSuggestions
      .filter((item) => item.priority === "urgent")
      .map((item) => ({ ...item, accountName: account.name, accountEmail: account.email })),
  );
  if (!urgent.length) return;

  const { DB, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = bindings();
  if (!DB || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return;
  await initializeDatabase(DB);
  const rows = await DB.prepare(`
    SELECT endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE last_digest_id IS NULL OR last_digest_id != ?
  `).bind(run.id).all<StoredSubscription>();

  const first = urgent[0];
  const title = urgent.length === 1 ? `緊急信件｜Gmail ${first.accountName}` : `發現 ${urgent.length} 封緊急信件`;
  const body =
    urgent.length === 1
      ? `${first.subject || "需要立即處理"}\n${first.summary}`
      : `${first.subject || first.summary}\n另有 ${urgent.length - 1} 封需要處理`;
  const data = JSON.stringify({
    title,
    body,
    url: gmailThreadUrl(first.accountEmail, first.threadId),
    tag: `inbox-daily-${run.id}`,
  });

  await Promise.all(rows.results.map(async (row) => {
    const subscription: PushSubscription = {
      endpoint: row.endpoint,
      expirationTime: null,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    try {
      const payload = await buildPushPayload(
        { data, options: { ttl: 3600, urgency: "high", topic: "inbox-daily-urgent" } },
        subscription,
        {
          subject: VAPID_SUBJECT,
          publicKey: VAPID_PUBLIC_KEY,
          privateKey: VAPID_PRIVATE_KEY,
        },
      );
      const response = await fetch(row.endpoint, payload);
      if (response.ok) {
        await DB.prepare(
          "UPDATE push_subscriptions SET last_digest_id = ? WHERE endpoint = ?",
        ).bind(run.id, row.endpoint).run();
      } else if (response.status === 404 || response.status === 410) {
        await DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(row.endpoint).run();
      }
    } catch {
      // A failed push must not block the hourly Gmail digest.
    }
  }));
}

