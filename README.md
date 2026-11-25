# Orchard · idea OS by Jay Motion

Plant every business idea, score it, duel it against the others, and harvest the best 5–6 into your final shop.

- `index.html` — the whole app (no build step).
- `api/data.js` — cloud sync: one private JSON file in Vercel Blob, protected by the `ORCHARD_PASS` passcode.
- Without a passcode, the app saves only in the visitor's browser (public demo mode).

Env vars on Vercel: `BLOB_READ_WRITE_TOKEN` (added by the Blob store), `ORCHARD_PASS` (your private passcode).
Live at https://orchard.jaymotion.tech
