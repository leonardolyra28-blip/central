ALTER TABLE `imported_leads` ADD `state` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `imported_leads` ADD `last_contact` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `imported_leads` ADD `custom_fields` text DEFAULT '{}' NOT NULL;