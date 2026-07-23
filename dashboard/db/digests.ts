import { env } from "cloudflare:workers";

export type AiSummary = { category: string; summary: string };
export type AccountDigest = {
  name: string;
  email: string;
  matched: Record<string, number>;
  archived: number;
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
}

export async function getDigestRuns(): Promise<DigestRun[]> {
  const db = bindings().DB;
  if (!db) return [];
  await initializeDatabase(db);
  const result = await db
    .prepare("SELECT payload_json FROM digest_runs ORDER BY created_at DESC LIMIT 60")
    .all<{ payload_json: string }>();
  return result.results.map((row) => JSON.parse(row.payload_json) as DigestRun);
}
