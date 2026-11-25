// Orchard shared sync: one private JSON document in Vercel Blob, protected by a shared password.
// PUT merges the incoming copy with the stored one, so several people can edit at the same time.
import { put, get } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';

const PATH = 'orchard/data.json';

function authorized(req) {
  const pass = (process.env.ORCHARD_PASS || '').trim().toLowerCase();
  const given = String(req.headers['x-orchard-key'] || '').trim().toLowerCase();
  if (!pass || !given) return false;
  const a = Buffer.from(pass), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readStore() {
  const result = await get(PATH, { access: 'private', useCache: false });
  if (!result) return null;
  return JSON.parse(await new Response(result.stream).text());
}

const t = x => (x && x.u) || 0;
const chk = x => (x && typeof x === 'object' ? x : { v: !!x, u: 0 });

// Newest edit wins per idea, per business and per checklist item. Deletions are kept as tombstones.
function merge(a, b) {
  if (!a) return b;
  const del = { ...(a.del || {}) };
  for (const [id, ts] of Object.entries(b.del || {})) del[id] = Math.max(del[id] || 0, ts);
  const pick = (x, y) => {
    const m = new Map();
    for (const item of [...(x || []), ...(y || [])]) {
      if (!item || !item.id) continue;
      const prev = m.get(item.id);
      if (!prev || t(item) >= t(prev)) m.set(item.id, item);
    }
    return [...m.values()].filter(item => !(del[item.id] > t(item)));
  };
  const checks = {};
  for (const src of [a.checks || {}, b.checks || {}]) {
    for (const [fid, items] of Object.entries(src)) {
      checks[fid] = checks[fid] || {};
      for (const [k, raw] of Object.entries(items || {})) {
        const c = chk(raw), prev = checks[fid][k];
        if (!prev || c.u >= prev.u) checks[fid][k] = c;
      }
    }
  }
  const packs = { ...(a.packs || {}) };
  for (const [k, ts] of Object.entries(b.packs || {})) packs[k] = Math.max(packs[k] || 0, ts);
  return { v: 3, fields: pick(a.fields, b.fields), ideas: pick(a.ideas, b.ideas), checks, del, packs, updatedAt: Date.now() };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });

  try {
    if (req.method === 'GET') {
      const data = await readStore();
      if (!data) return res.status(404).json({ error: 'empty' });
      return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.fields) || !Array.isArray(body.ideas)) {
        return res.status(400).json({ error: 'invalid data' });
      }
      const merged = merge(await readStore(), body);
      await put(PATH, JSON.stringify(merged), {
        access: 'private',
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: 'application/json',
      });
      return res.status(200).json(merged);
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'storage error' });
  }
}
