// Orchard cloud sync: one private JSON document in Vercel Blob, protected by a passcode.
import { put, get } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';

const PATH = 'orchard/data.json';

function authorized(req) {
  const pass = process.env.ORCHARD_PASS || '';
  const given = String(req.headers['x-orchard-key'] || '');
  if (!pass || !given) return false;
  const a = Buffer.from(pass), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });

  try {
    if (req.method === 'GET') {
      const result = await get(PATH, { access: 'private', useCache: false });
      if (!result) return res.status(404).json({ error: 'empty' });
      const text = await new Response(result.stream).text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(text);
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.fields) || !Array.isArray(body.ideas)) {
        return res.status(400).json({ error: 'invalid data' });
      }
      body.updatedAt = body.updatedAt || Date.now();
      await put(PATH, JSON.stringify(body), {
        access: 'private',
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: 'application/json',
      });
      return res.status(200).json({ ok: true, updatedAt: body.updatedAt });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'storage error' });
  }
}
