set -e
cd /home/user/clinic-management
U=postgres://clinic:clinic@localhost:5432
psql $U/postgres -qc "drop database if exists clinic_demo with (force)" -c "create database clinic_demo"
export DATABASE_URL=$U/clinic_demo
npx drizzle-kit migrate >/dev/null 2>&1
CLINIC_NAME="Sunrise Clinic" npx tsx scripts/seed.ts >/dev/null
npx tsx scripts/import-medicines.ts >/dev/null
npx tsx scripts/demo-data.ts >/dev/null
psql $DATABASE_URL -q <<'SQL'
update branches set address='12 Main Road, Adyar, Chennai', phone='044 2441 0000';
insert into patients (branch_id, patient_code, name, phone, age, gender) values
 (1,'PT-K7M3QR','Lakshmi Narayanan','9840012345',52,'female'),
 (1,'PT-B4X9TW','Arjun Kumar','9884023456',28,'male'),
 (1,'PT-H2N6VD','Fathima Begum','9791034567',41,'female'),
 (1,'PT-R8C5JP','Suresh Babu','9962045678',63,'male'),
 (1,'PT-W3Z7MA','Divya Ramesh','9003056789',8,'female');
insert into appointments (branch_id, doctor_id, patient_id, date, start_min, end_min, token_no, status, source, arrived_at)
select 1,1,p.id,(now() at time zone 'Asia/Kolkata')::date, 540+10*(rn-1), 550+10*(rn-1), rn,
  (case when rn<=3 then 'arrived' else 'booked' end)::appt_status, (case when rn=3 then 'walk_in' else 'online' end)::appt_source,
  case when rn<=3 then now() else null end
from (select id, row_number() over (order by id) rn from patients where patient_code in ('PT-K7M3QR','PT-B4X9TW','PT-H2N6VD','PT-R8C5JP','PT-W3Z7MA')) p;
insert into appointments (branch_id, doctor_id, patient_id, date, start_min, end_min, token_no, status, source, completed_at)
select 1,1,id,(now() at time zone 'Asia/Kolkata')::date - 30, 1190, 1200, 20, 'completed','online', now() - interval '30 days' from patients where patient_code='PT-K7M3QR';
insert into visits (appointment_id, complaint, diagnosis) select a.id,'Joint pain in knees','Osteoarthritis' from appointments a join patients p on p.id=a.patient_id where p.patient_code='PT-K7M3QR' and a.status='completed';
insert into payments (appointment_id, amount, mode) select a.id,300,'upi' from appointments a join patients p on p.id=a.patient_id where p.patient_code='PT-K7M3QR' and a.status='completed';
SQL
echo reset
