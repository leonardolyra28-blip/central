ALTER TABLE `tasks` ADD `start_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `end_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `all_day` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `calendar_color` text DEFAULT '#db8a19' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `reminder_minutes` integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `updated_by` text DEFAULT 'Equipe comercial' NOT NULL;