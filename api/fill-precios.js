// api/fill-precios.js
// Edita el ZIP del Excel directamente — cambia solo las celdas DESCRIPCION y PRECIO.
// Logos, imágenes, estilos y macros quedan byte a byte idénticos al original.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import * as XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Índices de shared strings en cada plantilla
// IMAN:     idx4=DESCRIPCION, idx5=PRECIO
// SIN_IMAN: idx2=DESCRIPCION, idx3=PRECIO
const TPL_CONFIG = {
  iman: {
    file:      'PRECIOS_IMAN.xlsm',
    sheets:    ['xl/worksheets/sheet1.xml'],
    idxDesc:   4,
    idxPrecio: 5,
    ext:       'xlsm',
  },
  sin_iman: {
    file:      'PRECIOS_SIN_IMAN.xlsx',
    sheets:    ['xl/worksheets/sheet1.xml'],
    idxDesc:   2,
    idxPrecio: 3,
    ext:       'xlsx',
  },
};

const escapeXml = s => s
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');

function fillSheet(xml, idxDesc, idxPrecio, products) {
  // Patrón exacto confirmado en ambas plantillas:
  // DESCRIPCION: <c r="B2" s="17" t="s"><v>4</v></c>
  // PRECIO:      <c r="B3" s="18" t="s"><v>5</v></c>

  const descRegex  = new RegExp(`<c r="[A-Z]+\\d+" s="\\d+" t="s"><v>${idxDesc}<\\/v><\\/c>`, 'g');
  const precioRegex = new RegExp(`<c r="[A-Z]+\\d+" s="\\d+" t="s"><v>${idxPrecio}<\\/v><\\/c>`, 'g');

  let dIdx = 0;
  let pIdx = 0;

  // Reemplazar DESCRIPCION → inline string con el nombre
  xml = xml.replace(descRegex, (match) => {
    const name = dIdx < products.length ? escapeXml(products[dIdx].name) : '';
    dIdx++;
    // Cambiar t="s" a t="str" y <v>4</v> por el nombre
    return match
      .replace(`t="s"`, `t="str"`)
      .replace(`<v>${idxDesc}</v>`, `<v>${name}</v>`);
  });

  // Reemplazar PRECIO → número (quitar t="s", poner valor numérico)
  xml = xml.replace(precioRegex, (match) => {
    if (pIdx >= products.length) {
      pIdx++;
      // Slot vacío — quitar shared string, dejar número vacío
      return match
        .replace(` t="s"`, '')
        .replace(`<v>${idxPrecio}</v>`, `<v></v>`);
    }
    const price = products[pIdx++].price;
    return match
      .replace(` t="s"`, '')
      .replace(`<v>${idxPrecio}</v>`, `<v>${price}</v>`);
  });

  return xml;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { cambios, template } = req.body;
    if (!cambios || !template)
      return res.status(400).json({ error: 'Faltan parámetros' });

    const cfg = TPL_CONFIG[template];
    if (!cfg) return res.status(400).json({ error: 'Plantilla desconocida: ' + template });

    // ── 1. LEER PRODUCTOS DEL ARCHIVO DE CAMBIOS ─────────────
    const cambiosBuf = Buffer.from(cambios, 'base64');
    const wbC        = XLSX.read(cambiosBuf, { type: 'buffer' });
    const sheetName  = wbC.SheetNames[wbC.SheetNames.length - 1];
    const wsC        = wbC.Sheets[sheetName];
    const rows       = XLSX.utils.sheet_to_json(wsC, { header: 1, defval: null, raw: true });

    const products = [];
    for (let i = 2; i < rows.length; i++) {
      const name = rows[i][1] != null ? String(rows[i][1]).trim().toUpperCase() : '';
      if (!name) continue;
      const price = parseFloat(String(rows[i][3] ?? '').replace(/[^\d.]/g, ''));
      if (isNaN(price)) continue;
      products.push({ name, price });
    }

    if (!products.length)
      return res.status(400).json({ error: `Sin productos en hoja "${sheetName}"` });

    // ── 2. ABRIR PLANTILLA COMO ZIP Y EDITAR XML ──────────────
    const tplPath = path.join(__dirname, '..', 'plantillas', cfg.file);
    const zip     = new AdmZip(tplPath);

    for (const sheetPath of cfg.sheets) {
      const entry = zip.getEntry(sheetPath);
      if (!entry) continue;
      const xml    = entry.getData().toString('utf8');
      const newXml = fillSheet(xml, cfg.idxDesc, cfg.idxPrecio, products);
      zip.updateFile(sheetPath, Buffer.from(newXml, 'utf8'));
    }

    // ── 3. DEVOLVER ARCHIVO MODIFICADO ────────────────────────
    const outBuf   = zip.toBuffer();
    const filename = `PRECIOS_${template.toUpperCase()}_${sheetName.replace(/\s/g, '-')}.${cfg.ext}`;

    return res.status(200).json({
      ok:       true,
      file:     outBuf.toString('base64'),
      filename,
      ext:      cfg.ext,
      count:    Math.min(products.length, 99),
      sheet:    sheetName,
    });

  } catch (err) {
    console.error('fill-precios error:', err);
    return res.status(500).json({ error: err.message });
  }
}
