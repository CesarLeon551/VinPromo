// api/fill-precios.js
// Edita el ZIP interno del Excel directamente — solo modifica el XML de celdas,
// sin tocar logos, imágenes, estilos, macros ni nada más.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Configuración de cada plantilla ──────────────────────────
// Índices de shared strings para DESCRIPCION y PRECIO en cada plantilla
// IMAN:     DESCRIPCION=4, PRECIO=5  (sheet1.xml = PRECIOS CHICOS)
// SIN_IMAN: DESCRIPCION=2, PRECIO=3  (sheet1.xml = hoja única)
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
    // Importar xlsx solo para leer el archivo de cambios
    const { default: XLSXmod } = await import('xlsx');
    const cambiosBuf = Buffer.from(cambios, 'base64');
    const wbC        = XLSXmod.read(cambiosBuf, { type: 'buffer' });
    const sheetName  = wbC.SheetNames[wbC.SheetNames.length - 1];
    const wsC        = wbC.Sheets[sheetName];
    const rows       = XLSXmod.utils.sheet_to_json(wsC, { header: 1, defval: null, raw: true });

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

    // ── 2. ABRIR PLANTILLA COMO ZIP ───────────────────────────
    const tplPath = path.join(__dirname, '..', 'plantillas', cfg.file);
    const zip     = new AdmZip(tplPath);

    // ── 3. EDITAR SOLO EL XML DE CADA HOJA ───────────────────
    let prodIdx = 0;

    for (const sheetPath of cfg.sheets) {
      const entry = zip.getEntry(sheetPath);
      if (!entry) continue;

      let xml = entry.getData().toString('utf8');

      // Reemplazar celdas con shared string DESCRIPCION (t="s"><v>idxDesc</v>)
      // por inline string con el nombre del producto (t="str"><v>NOMBRE</v>)
      // y celdas PRECIO (t="s"><v>idxPrecio</v>) por número con formato moneda

      // Regex para encontrar cada celda con el índice de DESCRIPCION
      const descRegex = new RegExp(
        `(<c [^>]*t="s"[^>]*>\\s*<v>${cfg.idxDesc}<\\/v>\\s*<\\/c>)`,
        'g'
      );
      const precioRegex = new RegExp(
        `(<c ([^>]*)t="s"([^>]*)>\\s*<v>${cfg.idxPrecio}<\\/v>\\s*<\\/c>)`,
        'g'
      );

      // Reemplazar DESCRIPCION
      xml = xml.replace(descRegex, (match) => {
        if (prodIdx >= products.length) {
          // Sin producto — dejar celda vacía manteniendo estilo
          return match
            .replace(`t="s"`, `t="str"`)
            .replace(`<v>${cfg.idxDesc}</v>`, `<v></v>`);
        }
        const name = escapeXml(products[prodIdx].name);
        return match
          .replace(`t="s"`, `t="str"`)
          .replace(`<v>${cfg.idxDesc}</v>`, `<v>${name}</v>`);
      });

      // Reemplazar PRECIO — necesitamos saber qué producto corresponde a cada precio
      // Resetear índice para iterar en paralelo con descripción
      // Como desc y precio van pareados en el mismo orden, usamos prodIdx
      // Pero como ya consumimos prodIdx en desc, usamos un índice separado para precio
      let priceIdx = 0;
      xml = xml.replace(precioRegex, (match, full, before, after) => {
        if (priceIdx >= products.length) {
          priceIdx++;
          return match
            .replace(`t="s"`, '')
            .replace(`<v>${cfg.idxPrecio}</v>`, `<v></v>`);
        }
        const price = products[priceIdx].price;
        priceIdx++;
        // Cambiar tipo a número, agregar formato moneda
        // El atributo s= (style) se conserva para mantener el formato visual (fuente grande, etc.)
        const newCell = match
          .replace(`t="s"`, '')  // quitar type="s" → queda como número
          .replace(`<v>${cfg.idxPrecio}</v>`, `<v>${price}</v>`);
        return newCell;
      });

      // ── Actualizar el sharedStrings para quitar referencias huérfanas ──
      // (no es necesario — Excel lo recalcula al abrir)

      zip.updateFile(sheetPath, Buffer.from(xml, 'utf8'));
    }

    // ── 4. DEVOLVER EL ZIP MODIFICADO ─────────────────────────
    const outBuf   = zip.toBuffer();
    const filename = `PRECIOS_${template.toUpperCase()}_${sheetName.replace(/\s/g, '-')}.${cfg.ext}`;

    return res.status(200).json({
      ok:       true,
      file:     outBuf.toString('base64'),
      filename,
      ext:      cfg.ext,
      count:    Math.min(products.length, prodIdx),
      sheet:    sheetName,
    });

  } catch (err) {
    console.error('fill-precios error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
