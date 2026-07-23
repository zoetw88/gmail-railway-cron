import { getAllowedViewer } from "@/app/viewer-access";
import { bindings, initializeDatabase } from "@/db/digests";

export const dynamic = "force-dynamic";

const COOLDOWN_SECONDS = 300;
export async function POST() {
  if (!(await getAllowedViewer())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const {
    DB,
    MANUAL_RUN_URL,
    MANUAL_RUN_TOKEN,
  } = bindings();
  if (!DB || !MANUAL_RUN_URL || !MANUAL_RUN_TOKEN) {
    return Response.json({ error: "manual run unavailable" }, { status: 503 });
  }

  await initializeDatabase(DB);
  await DB.prepare(`
    INSERT OR IGNORE INTO manual_runs (id, requested_at)
    VALUES ('all-mailboxes', datetime('now', '-10 minutes'))
  `).run();
  const lock = await DB.prepare(`
    UPDATE manual_runs
    SET requested_at = datetime('now')
    WHERE id = 'all-mailboxes'
      AND requested_at <= datetime('now', '-5 minutes')
  `).run();
  if ((lock.meta.changes ?? 0) !== 1) {
    return Response.json(
      { error: "cooldown", retryAfterSeconds: COOLDOWN_SECONDS },
      { status: 429, headers: { "retry-after": String(COOLDOWN_SECONDS) } },
    );
  }

  const response = await fetch(`${MANUAL_RUN_URL}/run`, {
    method: "POST",
    headers: {
      "x-manual-run-token": MANUAL_RUN_TOKEN,
    },
  });
  if (!response.ok) {
    await DB.prepare(`
      UPDATE manual_runs
      SET requested_at = datetime('now', '-10 minutes')
      WHERE id = 'all-mailboxes'
    `).run();
    return Response.json({ error: "manual runner rejected request" }, { status: 502 });
  }

  return Response.json({ ok: true }, { status: 202 });
}
