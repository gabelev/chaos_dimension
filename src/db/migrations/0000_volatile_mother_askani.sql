CREATE TABLE IF NOT EXISTS "agent_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	"revoked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "agent_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"task_id" text,
	"started_at" timestamp,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hostname" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"status" text DEFAULT 'running' NOT NULL,
	"log_url" text,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"workstream" text NOT NULL,
	"column" text NOT NULL,
	"agent_dispatchable" boolean DEFAULT false NOT NULL,
	"remote_runnable" boolean DEFAULT false NOT NULL,
	"priority" text DEFAULT 'med' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workstreams" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"color" text NOT NULL,
	"icon" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_tokens" ADD CONSTRAINT "agent_tokens_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "runs" ADD CONSTRAINT "runs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "runs" ADD CONSTRAINT "runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
