DROP INDEX "patients_phone_idx";--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "branches" SET "slug" = coalesce(nullif(trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''), 'clinic') || CASE WHEN "id" = (SELECT min("id") FROM "branches") THEN '' ELSE '-' || "id" END;--> statement-breakpoint
ALTER TABLE "branches" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "branch_id" integer;--> statement-breakpoint
UPDATE "patients" p SET "branch_id" = coalesce((SELECT a."branch_id" FROM "appointments" a WHERE a."patient_id" = p."id" ORDER BY a."id" LIMIT 1), (SELECT min("id") FROM "branches"));--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "branch_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patients_phone_idx" ON "patients" USING btree ("branch_id","phone");--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_slug_unique" UNIQUE("slug");
