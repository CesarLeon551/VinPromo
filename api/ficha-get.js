// api/ficha-get.js
// Lee la ficha técnica desde Vercel KV dado un ID

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Falta el ID' });

  try {
    const raw = await kv.get('ficha:' + id);
    if (!raw) return res.status(404).json({ error: 'Ficha no encontrada' });

    // raw puede ser string o ya objeto según la versión de KV
    const ficha = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return res.status(200).json(ficha);

  } catch (err) {
    console.error('ficha-get error:', err);
    return res.status(500).json({ error: err.message });
  }
}
