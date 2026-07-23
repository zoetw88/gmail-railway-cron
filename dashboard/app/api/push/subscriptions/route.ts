import { getAllowedViewer } from "@/app/viewer-access";
import { bindings, initializeDatabase } from "@/db/digests";

export const dynamic = "force-dynamic";

type SubscriptionPayload = {
  endpoint?: unknown;
  expirationTime?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

function validEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const user = await getAllowedViewer();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const value = (await request.json().catch(() => null)) as SubscriptionPayload | null;
  if (
    !value ||
    !validEndpoint(value.endpoint) ||
    typeof value.keys?.p256dh !== "string" ||
    value.keys.p256dh.length > 256 ||
    typeof value.keys.auth !== "string" ||
    value.keys.auth.length > 128
  ) {
    return Response.json({ error: "invalid subscription" }, { status: 400 });
  }

  const { DB } = bindings();
  if (!DB) return Response.json({ error: "database unavailable" }, { status: 503 });
  await initializeDatabase(DB);
  const count = await DB.prepare(
    "SELECT COUNT(*) AS total FROM push_subscriptions WHERE viewer_email = ?",
  ).bind(user.email.toLowerCase()).first<{ total: number }>();
  if ((count?.total ?? 0) >= 10) {
    return Response.json({ error: "device limit reached" }, { status: 429 });
  }

  await DB.prepare(`
    INSERT INTO push_subscriptions (
      endpoint, viewer_email, p256dh, auth, expiration_time, created_at, last_digest_id
    ) VALUES (?, ?, ?, ?, ?, datetime('now'), NULL)
    ON CONFLICT(endpoint) DO UPDATE SET
      viewer_email = excluded.viewer_email,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      expiration_time = excluded.expiration_time
  `).bind(
    value.endpoint,
    user.email.toLowerCase(),
    value.keys.p256dh,
    value.keys.auth,
    typeof value.expirationTime === "number" ? value.expirationTime : null,
  ).run();

  return Response.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getAllowedViewer();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const value = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!value || !validEndpoint(value.endpoint)) {
    return Response.json({ error: "invalid subscription" }, { status: 400 });
  }
  const { DB } = bindings();
  if (!DB) return Response.json({ error: "database unavailable" }, { status: 503 });
  await initializeDatabase(DB);
  await DB.prepare(
    "DELETE FROM push_subscriptions WHERE endpoint = ? AND viewer_email = ?",
  ).bind(value.endpoint, user.email.toLowerCase()).run();
  return Response.json({ ok: true });
}

