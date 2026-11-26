// Orchard idea photos: stored as private files in Vercel Blob, only reachable with the shared password.
import { put, get, del } from '@vercel/blob';
import { timingSafeEqual, randomBytes } from 'node:crypto';


const OK_PATH = /^orchard\/img\/[a-z0-9]{16}\.jpg$/;

function authorized(key) {
  const pass = (process.env.ORCHARD_PASS || '').trim().toLowerCase();
  const given = String(key || '').trim().toLowerCase();
  if (!pass || !given) return false;
  const a = Buffer.from(pass), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  const key = req.headers['x-orchard-key'] || req.query.k;
  if (!authorized(key)) return res.status(401).json({ error: 'unauthorized' });

  try {
    // Show a photo: <img src="/api/img?p=...&k=...">
    if (req.method === 'GET') {
      const p = String(req.query.p || '');
      if (!OK_PATH.test(p)) return res.status(400).json({ error: 'bad path' });
      const result = await get(p, { access: 'private' });
      if (!result) return res.status(404).json({ error: 'not found' });
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      return res.status(200).send(Buffer.from(await new Response(result.stream).arrayBuffer()));
    }

    // Upload a photo the app already resized: { data: "<base64 jpeg>" }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const buf = Buffer.from(String(body?.data || ''), 'base64');
      const isJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      if (!isJpeg || buf.length > 3 * 1024 * 1024) return res.status(400).json({ error: 'invalid image' });
      const path = `orchard/img/${randomBytes(8).toString('hex')}.jpg`;
      await put(path, buf, { access: 'private', addRandomSuffix: false, contentType: 'image/jpeg' });
      return res.status(200).json({ path });
    }

    // Remove a photo
    if (req.method === 'DELETE') {
      const p = String(req.query.p || '');
      if (!OK_PATH.test(p)) return res.status(400).json({ error: 'bad path' });
      await del(p);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'storage error' });
  }
}
