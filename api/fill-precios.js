// api/fill-precios.js
// Abre la plantilla elegida, reemplaza DESCRIPCION y PRECIO con los datos
// del archivo de cambios, y devuelve el archivo modificado en base64.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { cambios, template } = req.body;
    if (!cambios || !template)
      return res.status(400).json({ error: 'Faltan parámetros: cambios, template' });

    // ── 1. LEER PRODUCTOS DEL ARCHIVO DE CAMBIOS ─────────────
    const cambiosBuf = Buffer.from(cambios, 'base64');
    const wbC        = XLSX.read(cambiosBuf, { type: 'buffer' });
    const sheetName  = wbC.SheetNames[wbC.SheetNames.length - 1]; // última hoja
    const wsC        = wbC.Sheets[sheetName];
    const rows       = XLSX.utils.sheet_to_json(wsC, { header: 1, defval: null, raw: true });

    // Col B (índice 1) = descripción, Col D (índice 3) = precio, desde fila 3 (índice 2)
    const products = [];
    for (let i = 2; i < rows.length; i++) {
      const name = rows[i][1] != null ? String(rows[i][1]).trim().toUpperCase() : '';
      if (!name) continue;
      const price = parseFloat(String(rows[i][3] ?? '').replace(/[^\d.]/g, ''));
      if (isNaN(price)) continue;
      products.push({ name, price });
    }

    if (!products.length)
      return res.status(400).json({ error: `Sin productos válidos en hoja "${sheetName}"` });

    // ── 2. CARGAR PLANTILLA ───────────────────────────────────
    const tplFiles = {
      iman:     'PRECIOS_IMAN.xlsm',
      sin_iman: 'PRECIOS_SIN_IMAN.xlsx',
    };
    if (!tplFiles[template])
      return res.status(400).json({ error: 'Plantilla desconocida: ' + template });

    const tplPath = path.join(__dirname, '..', 'plantillas', tplFiles[template]);
    const tplBuf  = fs.readFileSync(tplPath);
    const wbTpl   = XLSX.read(tplBuf, { type: 'buffer', cellStyles: true, bookVBA: true });

    // ── 3. RELLENAR SLOTS EN ORDEN ────────────────────────────
    let prodIdx = 0;

    for (const sName of wbTpl.SheetNames) {
      const ws = wbTpl.Sheets[sName];
      if (!ws || !ws['!ref']) continue;

      const range  = XLSX.utils.decode_range(ws['!ref']);
      const dPos   = []; // posiciones DESCRIPCION
      const pPos   = []; // posiciones PRECIO

      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr];
          if (!cell) continue;
          const v = String(cell.v ?? '').trim().toUpperCase();
          if (v === 'DESCRIPCION') dPos.push(addr);
          else if (v === 'PRECIO') pPos.push(addr);
        }
      }

      const slots = Math.min(dPos.length, pPos.length);
      for (let i = 0; i < slots; i++) {
        const dCell = ws[dPos[i]];
        const pCell = ws[pPos[i]];

        if (prodIdx < products.length) {
          const p = products[prodIdx++];
          // Descripción
          dCell.v = p.name;
          dCell.t = 's';
          delete dCell.r; // eliminar rich text si había
          // Precio en formato moneda $489.00
          pCell.v = p.price;
          pCell.t = 'n';
          pCell.z = '"$"#,##0.00';
          delete pCell.r;
          delete pCell.w;
        } else {
          // Slot vacío — limpiar placeholder
          dCell.v = ''; dCell.t = 's'; delete dCell.r;
          pCell.v = ''; pCell.t = 's'; delete pCell.r; delete pCell.w; delete pCell.z;
        }
      }
    }

    // ── 4. EXPORTAR ───────────────────────────────────────────
    const ext      = template === 'iman' ? 'xlsm' : 'xlsx';
    const bookType = template === 'iman' ? 'xlsm' : 'xlsx';
    const outBuf   = XLSX.write(wbTpl, { type: 'buffer', bookType, bookVBA: true, cellStyles: true });
    const filename = `PRECIOS_${template.toUpperCase()}_${sheetName.replace(/\s/g, '-')}.${ext}`;

    return res.status(200).json({
      ok:       true,
      file:     outBuf.toString('base64'),
      filename,
      ext,
      count:    prodIdx,
      sheet:    sheetName,
    });

  } catch (err) {
    console.error('fill-precios error:', err);
    return res.status(500).json({ error: err.message });
  }
}
