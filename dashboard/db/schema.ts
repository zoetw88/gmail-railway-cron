import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const digestRuns = sqliteTable(
  "digest_runs",
  {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    dryRun: integer("dry_run", { mode: "boolean" }).notNull(),
    payloadJson: text("payload_json").notNull(),
  },
  (table) => [index("digest_runs_created_at_idx").on(table.createdAt)],
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    endpoint: text("endpoint").primaryKey(),
    viewerEmail: text("viewer_email").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    expirationTime: integer("expiration_time"),
    createdAt: text("created_at").notNull(),
    lastDigestId: text("last_digest_id"),
  },
  (table) => [index("push_subscriptions_viewer_idx").on(table.viewerEmail)],
);
