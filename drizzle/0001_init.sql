CREATE TYPE "public"."appt_source" AS ENUM('online', 'walk_in');--> statement-breakpoint
CREATE TYPE "public"."appt_status" AS ENUM('booked', 'arrived', 'in_consultation', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."exception_type" AS ENUM('leave', 'custom');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('cash', 'upi', 'card', 'other');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('doctor', 'receptionist');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"doctor_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"date" date NOT NULL,
	"start_min" smallint NOT NULL,
	"end_min" smallint NOT NULL,
	"token_no" smallint NOT NULL,
	"status" "appt_status" DEFAULT 'booked' NOT NULL,
	"source" "appt_source" DEFAULT 'online' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"arrived_at" timestamp with time zone,
	"in_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctors" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"display_name" text NOT NULL,
	"specialty" text,
	"qualifications" text,
	"registration_no" text,
	"consultation_fee" integer,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "doctors_staff_id_unique" UNIQUE("staff_id")
);
--> statement-breakpoint
CREATE TABLE "medicines" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_name" text NOT NULL,
	"composition" text,
	"form" text,
	"pack_size" text,
	"manufacturer" text,
	"source" text DEFAULT 'dataset' NOT NULL,
	"branch_id" integer
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer,
	"channel" text NOT NULL,
	"template" text NOT NULL,
	"status" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_code" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"age" smallint,
	"gender" "gender",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patients_patient_code_unique" UNIQUE("patient_code")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"mode" "payment_mode" NOT NULL,
	"received_by" integer,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_appointment_id_unique" UNIQUE("appointment_id")
);
--> statement-breakpoint
CREATE TABLE "prescription_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"prescription_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"medicine_id" integer,
	"name" text NOT NULL,
	"composition" text,
	"dose" text,
	"timing" text,
	"duration" text,
	"quantity" text,
	"instructions" text
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"visit_id" integer NOT NULL,
	"advice" text,
	"printed_at" timestamp with time zone,
	CONSTRAINT "prescriptions_visit_id_unique" UNIQUE("visit_id")
);
--> statement-breakpoint
CREATE TABLE "schedule_exceptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"doctor_id" integer NOT NULL,
	"date" date NOT NULL,
	"type" "exception_type" NOT NULL,
	"start_min" smallint,
	"end_min" smallint,
	"slot_minutes" smallint,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "schedule_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"doctor_id" integer NOT NULL,
	"weekday" smallint NOT NULL,
	"start_min" smallint NOT NULL,
	"end_min" smallint NOT NULL,
	"slot_minutes" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "staff_role" NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer NOT NULL,
	"complaint" text,
	"diagnosis" text,
	"notes" text,
	"follow_up_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visits_appointment_id_unique" UNIQUE("appointment_id")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_staff_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_sessions" ADD CONSTRAINT "schedule_sessions_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appt_slot_uq" ON "appointments" USING btree ("doctor_id","date","start_min") WHERE "appointments"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "appt_day_idx" ON "appointments" USING btree ("doctor_id","date");--> statement-breakpoint
CREATE INDEX "appt_patient_idx" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "appt_branch_date_idx" ON "appointments" USING btree ("branch_id","date");--> statement-breakpoint
CREATE INDEX "medicines_brand_trgm" ON "medicines" USING gin ("brand_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "medicines_comp_trgm" ON "medicines" USING gin ("composition" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "patients_phone_idx" ON "patients" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "payments_received_idx" ON "payments" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "exceptions_doctor_date_idx" ON "schedule_exceptions" USING btree ("doctor_id","date");--> statement-breakpoint
CREATE INDEX "sessions_doctor_idx" ON "schedule_sessions" USING btree ("doctor_id","weekday");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_email_uq" ON "staff" USING btree (lower("email"));