# Landing page walkthrough videos

Recorded with Playwright against a local build, then converted to MP4 into `public/videos/`.

1. `npm run build`, start Postgres, then `DATABASE_URL=postgres://clinic:clinic@localhost:5432/clinic_demo npm start`
2. `bash scripts/walkthroughs/reset.sh` (fresh demo clinic with today's queue)
3. `node patient.js && node reception.js && node doctor.js` from this folder (writes `.webm` here; `reset.sh` again before re-recording)
4. For each: `ffmpeg -ss 0.6 -i NAME.webm -c:v libx264 -crf 28 -pix_fmt yuv420p -movflags +faststart -an public/videos/NAME.mp4`
   and a poster: `ffmpeg -ss 1.2 -i NAME.webm -frames:v 1 public/videos/NAME.jpg`

Run on a weekday before 1 PM or after the evening session starts for the most natural "today" queue.
