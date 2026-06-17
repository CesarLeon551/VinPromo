// api/ficha-save.js
// Guarda la ficha técnica en Vercel KV (base de datos gratuita de Vercel)
// KV se conecta automáticamente via variables de entorno que Vercel inyecta

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ficha = req.body;
    if (!ficha || !ficha.name) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // ID único basado en nombre + timestamp
    const id = ficha.name
      .replace(/[^A-Z0-9]/gi, '')
      .substring(0, 12)
      .toUpperCase()
      + '_' + Date.now().toString(36).toUpperCase();

    // Guardar en KV con expiración de 90 días (en segundos)
    await kv.set('ficha:' + id, JSON.stringify(ficha), { ex: 60 * 60 * 24 * 90 });

    return res.status(200).json({ id, ok: true });

  } catch (err) {
    console.error('ficha-save error:', err);
    return res.status(500).json({ error: err.message });
  }
}
