CREATE TABLE `ai_conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text DEFAULT 'Nova conversa' NOT NULL,
	`owner_email` text NOT NULL,
	`status` text DEFAULT 'Ativa' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_tool_calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer NOT NULL,
	`actor_email` text NOT NULL,
	`tool_name` text NOT NULL,
	`arguments` text DEFAULT '{}' NOT NULL,
	`result_summary` text DEFAULT '' NOT NULL,
	`mutation` integer DEFAULT false NOT NULL,
	`confirmed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_usage_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer,
	`actor_email` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Concluído' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`owner_id` integer NOT NULL,
	`visibility` text DEFAULT 'Equipe' NOT NULL,
	`category` text DEFAULT 'Reunião' NOT NULL,
	`color` text DEFAULT '#6d5dfc' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`meeting_link` text DEFAULT '' NOT NULL,
	`lead_id` integer,
	`task_id` integer,
	`followup_lead_id` integer,
	`recurrence` text DEFAULT 'Nenhuma' NOT NULL,
	`reminder_minutes` integer DEFAULT 15 NOT NULL,
	`status` text DEFAULT 'Agendado' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text DEFAULT 'Equipe comercial' NOT NULL,
	`updated_by` text DEFAULT 'Equipe comercial' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `document_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_id` integer NOT NULL,
	`object_key` text NOT NULL,
	`version` integer NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`category` text DEFAULT 'Geral' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`visibility` text DEFAULT 'Equipe' NOT NULL,
	`uploaded_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'Disponível' NOT NULL,
	`linked_entity` text DEFAULT '' NOT NULL,
	`linked_record_id` integer,
	`preview_data` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_object_key_unique` ON `documents` (`object_key`);--> statement-breakpoint
CREATE TABLE `event_audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_participants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#6d5dfc' NOT NULL,
	`role` text DEFAULT 'Vendedor' NOT NULL,
	`permissions` text DEFAULT 'calendar:write,documents:read,ai:read' NOT NULL,
	`status` text DEFAULT 'Ativo' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
