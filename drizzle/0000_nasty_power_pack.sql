CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text DEFAULT 'Usuário' NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`record_id` integer,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`scope` text DEFAULT 'Empresa' NOT NULL,
	`owner_name` text DEFAULT 'Empresa' NOT NULL,
	`period_type` text DEFAULT 'Mensal' NOT NULL,
	`revenue_target` real DEFAULT 0 NOT NULL,
	`sales_target` integer DEFAULT 0 NOT NULL,
	`leads_target` integer DEFAULT 0 NOT NULL,
	`meetings_target` integer DEFAULT 0 NOT NULL,
	`proposals_target` integer DEFAULT 0 NOT NULL,
	`start_date` text DEFAULT '' NOT NULL,
	`end_date` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`whatsapp` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`instagram` text DEFAULT '' NOT NULL,
	`site` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`segment` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'Indicação' NOT NULL,
	`product_interest` text DEFAULT '' NOT NULL,
	`responsible` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Novo' NOT NULL,
	`potential_value` real DEFAULT 0 NOT NULL,
	`first_contact` text DEFAULT '' NOT NULL,
	`last_contact` text DEFAULT '' NOT NULL,
	`next_followup` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'Sem categoria' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`promotional_price` real,
	`minimum_price` real DEFAULT 0 NOT NULL,
	`cost` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Ativo' NOT NULL,
	`delivery_days` integer DEFAULT 0 NOT NULL,
	`target_audience` text DEFAULT '' NOT NULL,
	`problem_solved` text DEFAULT '' NOT NULL,
	`sales_arguments` text DEFAULT '' NOT NULL,
	`objections` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client` text NOT NULL,
	`product_id` integer,
	`product_name` text NOT NULL,
	`seller` text DEFAULT '' NOT NULL,
	`gross_value` real DEFAULT 0 NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`final_value` real DEFAULT 0 NOT NULL,
	`cost` real DEFAULT 0 NOT NULL,
	`payment_method` text DEFAULT 'Pix' NOT NULL,
	`date` text NOT NULL,
	`status` text DEFAULT 'Pendente' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`responsible` text DEFAULT '' NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'Média' NOT NULL,
	`status` text DEFAULT 'A fazer' NOT NULL,
	`lead_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
