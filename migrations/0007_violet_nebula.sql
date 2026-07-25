CREATE TABLE `user_oauth_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_id` text NOT NULL,
	`email` text,
	`email_verified` integer DEFAULT false,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_oauth_identities_provider_unique_idx` ON `user_oauth_identities` (`provider`,`provider_id`);--> statement-breakpoint
CREATE INDEX `user_oauth_identities_user_idx` ON `user_oauth_identities` (`user_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `ai_gateway_enabled` integer;--> statement-breakpoint
INSERT INTO `user_oauth_identities` (`id`, `user_id`, `provider`, `provider_id`, `email`, `email_verified`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), `id`, `provider`, `provider_id`, `email`, `email_verified`, `created_at`, `updated_at`
FROM `users`
WHERE `provider` IN ('google', 'github', 'cloudflare') AND `provider_id` IS NOT NULL;