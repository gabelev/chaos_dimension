CREATE TABLE IF NOT EXISTS "spec_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"spec_id" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_via" text DEFAULT 'ui' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "specs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"workstream_id" text,
	"task_id" text,
	"content" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_via" text DEFAULT 'ui' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text
);
