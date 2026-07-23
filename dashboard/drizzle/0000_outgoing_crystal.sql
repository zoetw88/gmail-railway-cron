CREATE TABLE `digest_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`dry_run` integer NOT NULL,
	`payload_json` text NOT NULL
);
