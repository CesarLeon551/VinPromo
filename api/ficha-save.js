// api/ficha-save.js
import { kv } from '@vercel/kv';
import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ficha = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body;

    if (!ficha || !ficha.name) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // ID corto para QR pequeños
    const prefix = ficha.name
      .replace(/[^A-Z0-9]/gi, '')
      .substring(0, 4)
      .toUpperCase();

    const randomId = crypto.randomBytes(3).toString('hex').toUpperCase();
    const id = `${prefix}${randomId}`;

    await kv.set(`ficha:${id}`, ficha, {
      ex: 60 * 60 * 24 * 90
    });

    return res.status(200).json({ ok: true, id });

  } catch (err) {
    console.error('ficha-save error:', err);

    return res.status(500).json({
      ok: false,
      error: err.message,
      hint: 'Verifica que KV esté configurado en Vercel'
    });
  }
}
