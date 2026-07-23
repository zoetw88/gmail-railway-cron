import { env } from "cloudflare:workers";

export type AiSummary = {
  category: string;
  summary: string;
  subject: string;
  threadId: string;
  priority: "urgent" | "important" | "normal";
};
export type AccountDigest = {
  name: string;
  email: string;
  matched: Record<string, number>;
  archived: number;
  aiLabelsApplied: number;
  aiSuggestions: AiSummary[];
  aiError: string | null;
};
export type DigestRun = {
  id: string;
  createdAt: string;
  dryRun: boolean;
  accounts: AccountDigest[];
};

type SiteEnv = {
  DB?: D1Database;
  INGEST_TOKEN?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  MANUAL_RUN_URL?: string;
  MANUAL_RUN_TOKEN?: string;
};

export function bindings(): SiteEnv {
  return env as unknown as SiteEnv;
}

export async function initializeDatabase(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS digest_runs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      dry_run INTEGER NOT NULL,
      payload_json TEXT NOT NULL
    )
  `).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS digest_runs_created_at_idx ON digest_runs(created_at DESC)").run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      viewer_email TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      expiration_time INTEGER,
      created_at TEXT NOT NULL,
      last_digest_id TEXT
    )
  `).run();
  await db.prepare(
    "CREATE INDEX IF NOT EXISTS push_subscriptions_viewer_idx ON push_subscriptions(viewer_email)",
  ).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS manual_runs (
      id TEXT PRIMARY KEY,
      requested_at TEXT NOT NULL
    )
  `).run();
}

export async function getDigestRuns(): Promise<DigestRun[]> {
  const db = bindings().DB;
  if (!db) return [];
  await initializeDatabase(db);
  const result = await db
    .prepare("SELECT payload_json FROM digest_runs ORDER BY created_at DESC LIMIT 1")
    .all<{ payload_json: string }>();
  return result.results.map((row) => JSON.parse(row.payload_json) as DigestRun);
}
