CREATE TABLE `import_errors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`row_number` integer NOT NULL,
	`error` text NOT NULL,
	`raw_data` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `imported_leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer,
	`name` text DEFAULT '' NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`niche_id` integer,
	`niche_name` text DEFAULT 'Sem nicho' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`whatsapp` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`instagram` text DEFAULT '' NOT NULL,
	`site` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'Importação' NOT NULL,
	`responsible` text DEFAULT '' NOT NULL,
	`contact_status` text DEFAULT 'Não contatado' NOT NULL,
	`product_interest` text DEFAULT '' NOT NULL,
	`potential_value` real DEFAULT 0 NOT NULL,
	`next_followup` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`pipeline_lead_id` integer,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lead_contact_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`imported_lead_id` integer NOT NULL,
	`actor` text DEFAULT 'Equipe comercial' NOT NULL,
	`old_status` text DEFAULT '' NOT NULL,
	`new_status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lead_import_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text DEFAULT 'Colagem manual' NOT NULL,
	`source` text DEFAULT 'Colagem' NOT NULL,
	`imported_by` text DEFAULT 'Equipe comercial' NOT NULL,
	`total_rows` integer DEFAULT 0 NOT NULL,
	`imported_rows` integer DEFAULT 0 NOT NULL,
	`duplicate_rows` integer DEFAULT 0 NOT NULL,
	`skipped_rows` integer DEFAULT 0 NOT NULL,
	`error_rows` integer DEFAULT 0 NOT NULL,
	`niches_found` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lead_pipeline_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`imported_lead_id` integer NOT NULL,
	`pipeline_lead_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_pipeline_links_imported_lead_id_unique` ON `lead_pipeline_links` (`imported_lead_id`);--> statement-breakpoint
CREATE TABLE `niches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#6d5dfc' NOT NULL,
	`status` text DEFAULT 'Ativo' NOT NULL,
	`default_responsible` text DEFAULT '' NOT NULL,
	`recommended_product` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `niches_name_unique` ON `niches` (`name`);