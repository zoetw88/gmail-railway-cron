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
