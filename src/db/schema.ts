import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Times of day are stored as minutes from midnight in the branch's local time
// (e.g. 9:30 = 570). Dates are plain calendar dates in the branch's timezone.

export const staffRole = pgEnum("staff_role", ["doctor", "receptionist"]);
export const apptStatus = pgEnum("appt_status", [
  "booked",
  "arrived",
  "in_consultation",
  "completed",
  "cancelled",
  "no_show",
]);
export const apptSource = pgEnum("appt_source", ["online", "walk_in"]);
export const paymentMode = pgEnum("payment_mode", ["cash", "upi", "card", "other"]);
export const exceptionType = pgEnum("exception_type", ["leave", "custom"]);
export const gender = pgEnum("gender", ["male", "female", "other"]);

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staff = pgTable(
  "staff",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id").notNull().references(() => branches.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: staffRole("role").notNull(),
    isAdmin: boolean("is_admin").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("staff_email_uq").on(sql`lower(${t.email})`)],
);

export const doctors = pgTable("doctors", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().unique().references(() => staff.id),
  branchId: integer("branch_id").notNull().references(() => branches.id),
  displayName: text("display_name").notNull(),
  specialty: text("specialty"),
  qualifications: text("qualifications"),
  registrationNo: text("registration_no"),
  consultationFee: integer("consultation_fee"),
  active: boolean("active").notNull().default(true),
});

export const scheduleSessions = pgTable(
  "schedule_sessions",
  {
    id: serial("id").primaryKey(),
    doctorId: integer("doctor_id").notNull().references(() => doctors.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(), // 0 = Sunday … 6 = Saturday
    startMin: smallint("start_min").notNull(),
    endMin: smallint("end_min").notNull(),
    slotMinutes: smallint("slot_minutes").notNull(),
  },
  (t) => [index("sessions_doctor_idx").on(t.doctorId, t.weekday)],
);

export const scheduleExceptions = pgTable(
  "schedule_exceptions",
  {
    id: serial("id").primaryKey(),
    doctorId: integer("doctor_id").notNull().references(() => doctors.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    type: exceptionType("type").notNull(),
    // For "custom": the sessions that replace the weekly pattern on this date.
    startMin: smallint("start_min"),
    endMin: smallint("end_min"),
    slotMinutes: smallint("slot_minutes"),
    note: text("note"),
  },
  (t) => [index("exceptions_doctor_date_idx").on(t.doctorId, t.date)],
);

export const patients = pgTable(
  "patients",
  {
    id: serial("id").primaryKey(),
    patientCode: text("patient_code").notNull().unique(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    age: smallint("age"),
    gender: gender("gender"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("patients_phone_idx").on(t.phone)],
);

export const appointments = pgTable(
  "appointments",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id").notNull().references(() => branches.id),
    doctorId: integer("doctor_id").notNull().references(() => doctors.id),
    patientId: integer("patient_id").notNull().references(() => patients.id),
    date: date("date").notNull(),
    startMin: smallint("start_min").notNull(),
    endMin: smallint("end_min").notNull(),
    tokenNo: smallint("token_no").notNull(),
    status: apptStatus("status").notNull().default("booked"),
    source: apptSource("source").notNull().default("online"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    inAt: timestamp("in_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    // Only one live booking per doctor + slot; cancelled ones free the slot.
    uniqueIndex("appt_slot_uq")
      .on(t.doctorId, t.date, t.startMin)
      .where(sql`${t.status} <> 'cancelled'`),
    index("appt_day_idx").on(t.doctorId, t.date),
    index("appt_patient_idx").on(t.patientId),
    index("appt_branch_date_idx").on(t.branchId, t.date),
  ],
);

export const visits = pgTable("visits", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").notNull().unique().references(() => appointments.id),
  complaint: text("complaint"),
  diagnosis: text("diagnosis"),
  notes: text("notes"),
  followUpDate: date("follow_up_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const prescriptions = pgTable("prescriptions", {
  id: serial("id").primaryKey(),
  visitId: integer("visit_id").notNull().unique().references(() => visits.id, { onDelete: "cascade" }),
  advice: text("advice"),
  printedAt: timestamp("printed_at", { withTimezone: true }),
});

export const medicines = pgTable(
  "medicines",
  {
    id: serial("id").primaryKey(),
    brandName: text("brand_name").notNull(),
    composition: text("composition"),
    form: text("form"),
    packSize: text("pack_size"),
    manufacturer: text("manufacturer"),
    source: text("source").notNull().default("dataset"), // dataset | custom
    branchId: integer("branch_id").references(() => branches.id), // set for clinic custom entries
  },
  (t) => [
    index("medicines_brand_trgm").using("gin", sql`${t.brandName} gin_trgm_ops`),
    index("medicines_comp_trgm").using("gin", sql`${t.composition} gin_trgm_ops`),
  ],
);

export const prescriptionItems = pgTable("prescription_items", {
  id: serial("id").primaryKey(),
  prescriptionId: integer("prescription_id")
    .notNull()
    .references(() => prescriptions.id, { onDelete: "cascade" }),
  position: smallint("position").notNull(),
  medicineId: integer("medicine_id").references(() => medicines.id),
  name: text("name").notNull(), // snapshot so old prints never change
  composition: text("composition"),
  dose: text("dose"), // e.g. 1-0-1
  timing: text("timing"), // e.g. after food
  duration: text("duration"), // e.g. 5 days
  quantity: text("quantity"),
  instructions: text("instructions"),
});

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    appointmentId: integer("appointment_id").notNull().unique().references(() => appointments.id),
    amount: integer("amount").notNull(), // whole rupees
    mode: paymentMode("mode").notNull(),
    receivedBy: integer("received_by").references(() => staff.id),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_received_idx").on(t.receivedAt)],
);

export const notificationLog = pgTable("notification_log", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  channel: text("channel").notNull(),
  template: text("template").notNull(),
  status: text("status").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});
