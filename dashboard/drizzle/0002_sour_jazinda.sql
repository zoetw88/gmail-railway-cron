CREATE TABLE `push_subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`viewer_email` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`expiration_time` integer,
	`created_at` text NOT NULL,
	`last_digest_id` text
);
--> statement-breakpoint
CREATE INDEX `push_subscriptions_viewer_idx` ON `push_subscriptions` (`viewer_email`);