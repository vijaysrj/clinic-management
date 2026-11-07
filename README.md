# Clinic management

A simple web app for a clinic: patients book a slot without signing up and track how many people are ahead of them; reception runs the queue and records payments; doctors write prescriptions and review history and reports.

## Roles

| Who | Signs in | Can |
| --- | --- | --- |
| Patient | No | Book a slot, get a patient ID (e.g. `PT-7K3M9Q`), check queue position, cancel |
| Receptionist | Yes | Walk-in bookings, mark Arrived / Gone in / Completed / No-show, record amount + payment mode, set schedules |
| Doctor | Yes | Everything above for their own schedule, plus the doctor's pad, patient history and reports |

An admin (set on a staff account) manages the team and the clinic details.

## Stack

Next.js (App Router) · Postgres · Drizzle ORM · Tailwind CSS. Staff sessions are signed cookies (`AUTH_SECRET`).

## Run locally

```bash
cp .env.example .env          # set DATABASE_URL and AUTH_SECRET
npm install
npm run db:migrate            # create tables
npm run db:seed               # clinic, one admin doctor, one receptionist, Mon–Sat hours
npm run dev
```

Seed logins (change them under Team, or set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `RECEPTION_EMAIL`, `RECEPTION_PASSWORD` before seeding):

- Doctor (admin): `doctor@clinic.test` / `doctor123`
- Receptionist: `reception@clinic.test` / `reception123`

## Deploy on Vercel

1. Import the repo in Vercel and add a Postgres database (Storage → Neon). This sets `DATABASE_URL`.
2. Add `AUTH_SECRET` (any long random string).
3. Deploy. The build runs migrations and loads the medicine list.
4. Open `/register` to create a clinic and its admin doctor. Any number of clinics can register; each gets its own patient page at `/c/<slug>` and its patients, staff and reports are kept separate. The home page `/` is the product landing page with clinic search and a Patient ID lookup.

## Medicines

`data/medicines-starter.csv` has common Indian brands. To load a fuller list, download a CSV such as the "A-Z medicine dataset of India" and run `npm run medicines:import -- path/to/file.csv`.

## Notes

- Times are stored as minutes from midnight in the clinic's timezone (`CLINIC_TZ`, default `Asia/Kolkata`).
- Slots are computed from weekly hours plus leave / special-hours exceptions, so changing the slot length never moves existing bookings.
- A partial unique index stops two people booking the same doctor + slot.
- Every record carries a branch so more branches can be added later.

`npm test` runs the unit tests for slot building and ID handling.
