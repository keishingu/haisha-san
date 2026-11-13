CREATE TYPE "public"."member_role" AS ENUM('member', 'kakari');--> statement-breakpoint
CREATE TABLE "members" (
	"cairn_user_id" text PRIMARY KEY NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"role_updated_by_id" text,
	"role_updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "member_origins" (
	"cairn_user_id" text PRIMARY KEY NOT NULL,
	"address_input" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"can_drive" boolean DEFAULT false NOT NULL,
	"vehicle_capacity" integer,
	"updated_by_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_origins_capacity" CHECK (("member_origins"."can_drive" and "member_origins"."vehicle_capacity" >= 1) or (not "member_origins"."can_drive" and "member_origins"."vehicle_capacity" is null))
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cairn_project_id" text NOT NULL,
	"project_title" text NOT NULL,
	"destination_label" text NOT NULL,
	"destination_lat" double precision NOT NULL,
	"destination_lng" double precision NOT NULL,
	"optimization_mode" text NOT NULL,
	"participants" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"notes" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "plans_project_idx" ON "plans" USING btree ("cairn_project_id","created_at");