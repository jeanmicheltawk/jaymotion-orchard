# Orchard · idea OS by Jay Motion

Plant every business idea, score it, duel it against the others, and harvest the best 5–6 into your final shop.

- `index.html` — the whole app (no build step).
- `api/data.js` — cloud sync: one private JSON file in Vercel Blob, protected by the shared `ORCHARD_PASS` password. Edits from several people are merged (newest change per idea wins).
- A password screen opens first; everyone who enters it shares the same ideas.

Env vars on Vercel: `BLOB_READ_WRITE_TOKEN` (added by the Blob store), `ORCHARD_PASS` (the shared password).
Live at https://orchard.jaymotion.tech
