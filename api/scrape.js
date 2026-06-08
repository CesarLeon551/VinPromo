// api/scrape.js — Vercel Serverless Function
// Busca información del producto en múltiples fuentes públicas gratuitas

export default async function handler(req, res) {
  // CORS — permite llamadas desde cualquier origen (todas las sucursales)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, category, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Falta el nombre del producto' });

  const query = `${name} ${category || ''} ${description || ''}`.trim();

  try {
    // Intentar múltiples fuentes en paralelo
    const [wikiData, duckData] = await Promise.allSettled([
      scrapeWikipedia(name, category),
      scrapeDuckDuckGo(query),
    ]);

    // Combinar resultados
    const wiki = wikiData.status === 'fulfilled' ? wikiData.value : {};
    const duck = duckData.status === 'fulfilled' ? duckData.value : {};

    // Construir ficha con lo encontrado, rellenando con defaults inteligentes por categoría
    const ficha = buildFicha(name, category, description, wiki, duck);
    return res.status(200).json(ficha);

  } catch (err) {
    console.error('Scrape error:', err);
    // Si falla el scraping, devolver ficha con defaults por categoría
    const ficha = buildFicha(name, category, description, {}, {});
    return res.status(200).json(ficha);
  }
}

// ── WIKIPEDIA ────────────────────────────────────────────────
async function scrapeWikipedia(name, category) {
  // Usar la API pública de Wikipedia (sin restricciones)
  const searchTerm = encodeURIComponent(name.toLowerCase());
  const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${searchTerm}`;
  
  const r = await fetch(url, {
    headers: { 'User-Agent': 'VinateriaPRO/1.0 (etiquetas@vinateria.com)' }
  });
  
  if (!r.ok) {
    // Intentar en inglés
    const r2 = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${searchTerm}`, {
      headers: { 'User-Agent': 'VinateriaPRO/1.0' }
    });
    if (!r2.ok) return {};
    const d2 = await r2.json();
    return { extract: d2.extract || '', title: d2.title || '' };
  }
  
  const data = await r.json();
  return { extract: data.extract || '', title: data.title || '' };
}

// ── DUCKDUCKGO INSTANT ANSWER API ────────────────────────────
// API pública y gratuita de DuckDuckGo
async function scrapeDuckDuckGo(query) {
  const q = encodeURIComponent(query + ' bebida alcoholica origen');
  const url = `https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`;
  
  const r = await fetch(url, {
    headers: { 'User-Agent': 'VinateriaPRO/1.0' }
  });
  
  if (!r.ok) return {};
  const data = await r.json();
  
  return {
    abstract: data.Abstract || '',
    answer: data.Answer || '',
    relatedTopics: (data.RelatedTopics || []).slice(0, 3).map(t => t.Text || '').filter(Boolean),
  };
}

// ── BUILD FICHA ──────────────────────────────────────────────
// Construye la ficha combinando scraping + conocimiento por categoría
function buildFicha(name, category, description, wiki, duck) {
  const cat = (category || '').toUpperCase();
  const extract = wiki.extract || duck.abstract || '';
  
  // Extraer información del texto obtenido
  const pais = extractCountry(extract, cat, name) || getDefaultPais(cat, name);
  const region = extractRegion(extract, cat, name) || getDefaultRegion(cat, name);
  
  // Defaults por categoría
  const defaults = getCategoryDefaults(cat, name);
  
  return {
    marca:     extractMarca(name) || defaults.marca,
    pais:      pais,
    region:    region,
    uva:       defaults.uva,
    alc:       defaults.alc,
    anejo:     defaults.anejo,
    temp:      defaults.temp,
    color:     defaults.color,
    contenido: extractContenido(description) || '750 ml',
    aromas:    defaults.aromas,
    sabor:     defaults.sabor,
    maridaje:  defaults.maridaje,
    nota:      buildNota(extract, name, category, duck) || defaults.nota,
    source:    extract ? 'web' : 'default',
  };
}

// ── EXTRACTORES DE TEXTO ─────────────────────────────────────
function extractCountry(text, cat, name) {
  if (!text) return null;
  const countries = {
    'México':'México','Mexico':'México','Mexican':'México',
    'Francia':'Francia','France':'Francia','French':'Francia',
    'España':'España','Spain':'España','Spanish':'España',
    'Escocia':'Escocia','Scotland':'Escocia','Scotch':'Escocia',
    'Irlanda':'Irlanda','Ireland':'Irlanda','Irish':'Irlanda',
    'Italia':'Italia','Italy':'Italia','Italian':'Italia',
    'Chile':'Chile','Argentina':'Argentina','Colombia':'Colombia',
    'Estados Unidos':'EUA','United States':'EUA','American':'EUA','Tennessee':'EUA','Kentucky':'EUA',
    'Cognac':'Francia','Champagne':'Francia',
    'Cuba':'Cuba','Jamaica':'Jamaica','Barbados':'Barbados',
    'Rusia':'Rusia','Russia':'Rusia','Poland':'Polonia',
    'Japón':'Japón','Japan':'Japón','Japanese':'Japón',
  };
  for (const [key, val] of Object.entries(countries)) {
    if (text.includes(key)) return val;
  }
  return null;
}

function extractRegion(text, cat, name) {
  if (!text) return null;
  const regions = [
    'Jalisco','Oaxaca','Tequilana','Los Altos','Valle de Guadalupe',
    'Cognac','Bordeaux','Burgundy','Champagne','Rioja','Priorat',
    'Tuscany','Toscana','Piedmont','Barossa','Napa Valley',
    'Tennessee','Kentucky','Speyside','Highlands','Islay',
    'Mendoza','Valle Central','Maipo','Colchagua',
  ];
  for (const r of regions) {
    if (text.includes(r)) return r;
  }
  return null;
}

function extractMarca(name) {
  // La marca usualmente es el nombre del producto o su primera parte
  const parts = name.split(' ');
  if (parts.length >= 2) return parts.slice(0, 2).join(' ');
  return name;
}

function extractContenido(desc) {
  if (!desc) return null;
  const match = desc.match(/(\d{2,4})\s*ml/i);
  return match ? match[0] : null;
}

function buildNota(extract, name, category, duck) {
  if (!extract || extract.length < 50) return null;
  // Tomar las primeras 2 oraciones del extract de Wikipedia
  const sentences = extract.split(/\.\s+/).slice(0, 2).join('. ');
  if (sentences.length > 30) return sentences + '.';
  return null;
}

// ── DEFAULTS POR CATEGORÍA ───────────────────────────────────
function getDefaultPais(cat, name) {
  const n = name.toUpperCase();
  if (cat.includes('TEQUILA') || cat.includes('MEZCAL')) return 'México';
  if (cat.includes('COGNAC') || cat.includes('COÑAC')) return 'Francia';
  if (cat.includes('CHAMPAGNE')) return 'Francia';
  if (cat.includes('WHISKEY')) return 'EUA';
  if (cat.includes('WHISKY') || cat.includes('SCOTCH')) return 'Escocia';
  if (cat.includes('VODKA')) return 'Rusia / Polonia';
  if (cat.includes('RON') || cat.includes('RUM')) return 'Caribe';
  if (cat.includes('GIN')) return 'Reino Unido';
  if (n.includes('HERRADURA') || n.includes('PATRON') || n.includes('CAZADORES')) return 'México';
  if (n.includes('JACK DANIEL') || n.includes('JIM BEAM') || n.includes('BUFFALO')) return 'EUA';
  if (n.includes('JOHNNIE WALKER') || n.includes('GLENFIDDICH') || n.includes('GLENLIVET')) return 'Escocia';
  if (n.includes('HENNESSY') || n.includes('REMY') || n.includes('MARTELL')) return 'Francia';
  if (n.includes('BACARDI') || n.includes('HAVANA') || n.includes('DIPLOMATICO')) return 'Caribe';
  if (n.includes('SMIRNOFF') || n.includes('ABSOLUT') || n.includes('GREY GOOSE')) return 'Europa';
  if (cat.includes('VINO')) return 'México / Chile / España';
  return 'Internacional';
}

function getDefaultRegion(cat, name) {
  const n = name.toUpperCase();
  if (cat.includes('TEQUILA')) return 'Jalisco — D.O. Tequila';
  if (cat.includes('MEZCAL')) return 'Oaxaca — D.O. Mezcal';
  if (cat.includes('COGNAC') || cat.includes('COÑAC')) return 'Cognac, Charente';
  if (cat.includes('WHISKEY')) return 'Tennessee / Kentucky';
  if (cat.includes('WHISKY') || cat.includes('SCOTCH')) return 'Speyside / Highlands';
  if (cat.includes('VODKA')) return '—';
  if (cat.includes('RON') || cat.includes('RUM')) return 'Caribe';
  if (cat.includes('VINO TINTO')) return 'Valle Central / Rioja';
  if (cat.includes('VINO BLANCO')) return 'Valle de Guadalupe / Loire';
  return '—';
}

function getCategoryDefaults(cat, name) {
  const n = name.toUpperCase();

  // TEQUILA
  if (cat.includes('TEQUILA')) {
    const isRepo = n.includes('REPO') || n.includes('REPOSADO');
    const isAnejo = n.includes('ANEJO') || n.includes('AÑEJO') || n.includes('EXTRA');
    const isBlanco = n.includes('PLATA') || n.includes('BLANCO') || n.includes('SILVER') || n.includes('CRISTALINO');
    return {
      marca: extractMarca(name),
      uva: 'Agave Tequilana Weber Azul 100%',
      alc: '38–40%',
      anejo: isAnejo ? 'Más de 12 meses en barrica de roble' : isRepo ? '2–11 meses en barrica de roble' : 'Sin añejamiento (proceso de destilación doble)',
      temp: 'Temperatura ambiente (neat) o con hielo',
      color: isBlanco ? 'Cristalino, transparente' : isRepo ? 'Dorado pálido con reflejos ámbar' : 'Ámbar dorado brillante',
      aromas: isBlanco ? 'Agave fresco, cítricos, hierba, notas florales' : isRepo ? 'Agave cocido, vainilla, canela, caramelo, madera' : 'Frutas tropicales, vainilla, roble, especias, chocolate',
      sabor: isBlanco ? 'Limpio y fresco, con agave prominente, final mineral y cítrico.' : isRepo ? 'Equilibrado, suave, dulce con taninos ligeros de roble, final cálido y persistente.' : 'Complejo y elegante, con cuerpo redondo, notas de caramelo y roble, final largo y especiado.',
      maridaje: 'Mariscos frescos, ceviche, tacos de cochinita, frutas tropicales',
      nota: `Tequila 100% agave elaborado en la región tequilera de Jalisco, México. Destilado siguiendo los métodos tradicionales de la D.O. Tequila, con agave seleccionado en su punto óptimo de madurez (8-12 años). ${isRepo ? 'El proceso de reposado le aporta carácter y suavidad sin perder la esencia del agave.' : isAnejo ? 'El añejamiento en barricas de roble le otorga complejidad y notas amaderadas únicas.' : 'En su versión blanca conserva la pureza y frescura del agave al máximo.'}`
    };
  }

  // MEZCAL
  if (cat.includes('MEZCAL')) {
    return {
      marca: extractMarca(name),
      uva: 'Agave Espadín (Angustifolia Haw)',
      alc: '40–46%',
      anejo: 'Destilación artesanal en alambique de cobre o barro',
      temp: 'Temperatura ambiente, en vaso caballito o copa de mezcal',
      color: 'Cristalino con reflejos plateados',
      aromas: 'Ahumado terroso, agave asado, cítricos, frutas secas, cuero',
      sabor: 'Ahumado característico al frente, agave prominente, cuerpo medio, final largo y cálido con notas minerales.',
      maridaje: 'Chapulines, tacos de barbacoa, mole negro, chocolate amargo, gusano de maguey',
      nota: `Mezcal artesanal elaborado en Oaxaca, México, bajo la Denominación de Origen Mezcal. Las piñas de agave se cuecen en hornos de tierra que le dan su característico ahumado natural. Cada lote es único gracias al proceso 100% artesanal.`
    };
  }

  // WHISKEY (americano)
  if (cat.includes('WHISKEY')) {
    return {
      marca: extractMarca(name),
      uva: 'Mezcla de maíz, centeno y cebada malteada',
      alc: '40–45%',
      anejo: 'Mínimo 2 años en barricas de roble blanco americano carbonizado',
      temp: 'Temperatura ambiente, con piedras de whisky o con hielo',
      color: 'Ámbar dorado cálido',
      aromas: 'Vainilla, caramelo, roble tostado, notas de maíz dulce, especias',
      sabor: 'Suave y dulce al inicio, con caramelo y vainilla, final cálido y ligeramente ahumado.',
      maridaje: 'Costillas BBQ, carnes ahumadas, chocolate oscuro, quesos curados',
      nota: `Whiskey estadounidense elaborado siguiendo las tradiciones destileras de EUA. Su proceso de maduración en barricas nuevas de roble carbonizado le aporta su característico color ámbar y sus notas dulces de vainilla y caramelo. Ideal para disfrutar solo o en cócteles clásicos.`
    };
  }

  // WHISKY (escocés)
  if (cat.includes('WHISKY') || cat.includes('SCOTCH')) {
    const age = name.match(/(\d+)/)?.[1];
    return {
      marca: extractMarca(name),
      uva: 'Cebada malteada seleccionada',
      alc: '40–43%',
      anejo: age ? `Mínimo ${age} años en barricas de roble (ex-bourbon y ex-sherry)` : 'Mínimo 12 años en barricas de roble europeo y americano',
      temp: '15–18°C, con unas gotas de agua para abrir los aromas',
      color: 'Ámbar cobrizo con reflejos dorados',
      aromas: 'Frutas secas, miel, vainilla, roble tostado, notas florales, ligero ahumado',
      sabor: 'Elegante y complejo, con miel y frutas maduras, taninos finos de roble, final persistente y cálido.',
      maridaje: 'Salmón ahumado, quesos azules, chocolate negro, puros, frutas secas',
      nota: `Single Malt Scotch Whisky elaborado en las Highlands/Speyside de Escocia bajo las estrictas normas de la Scotch Whisky Association. ${age ? `Sus ${age} años de maduración` : 'Su extensa maduración'} en barricas seleccionadas le otorgan una complejidad y elegancia que lo distinguen en cada copa.`
    };
  }

  // COGNAC / COÑAC
  if (cat.includes('COGNAC') || cat.includes('COÑAC')) {
    return {
      marca: extractMarca(name),
      uva: 'Ugni Blanc (Saint-Émilion)',
      alc: '40%',
      anejo: 'Mínimo 2 años en barricas de roble de Limousin (proceso doble destilación)',
      temp: '17–19°C en copa snifter precalentada',
      color: 'Ámbar cobre brillante con reflejos caoba',
      aromas: 'Frutas maduras, ciruela, pera, roble, flores blancas, vainilla, especias',
      sabor: 'Estructura elegante y sedosa, con taninos finos, notas de fruta madura y roble, final largo y cálido.',
      maridaje: 'Chocolate amargo 70%+, quesos azules, foie gras, frutas secas, cigarro puro',
      nota: `Cognac elaborado en la región de Charente, Francia, bajo la Appellation d'Origine Contrôlée (AOC) Cognac. Producido mediante doble destilación en alambiques de cobre Charentais y madurado en las bodegas de la casa. Una de las bebidas más refinadas y respetadas del mundo.`
    };
  }

  // VODKA
  if (cat.includes('VODKA')) {
    return {
      marca: extractMarca(name),
      uva: 'Granos seleccionados o papa (según marca)',
      alc: '40%',
      anejo: 'Triple destilación y filtración múltiple con carbón activado',
      temp: 'Muy frío, directo del congelador (-18°C)',
      color: 'Cristalino, completamente incoloro',
      aromas: 'Neutro y limpio, sutil nota de grano, ligero dulzor',
      sabor: 'Limpio y suave, sin sabores extraños, final corto y fresco. Extremadamente versátil.',
      maridaje: 'Caviar, arenque, pepinos encurtidos, cócteles varios (Bloody Mary, Moscow Mule)',
      nota: `Vodka producido mediante un riguroso proceso de destilación múltiple y filtración que garantiza su pureza y suavidad. Su carácter neutro lo convierte en la base perfecta para cócteles clásicos y creativos, siendo uno de los destilados más consumidos en el mundo.`
    };
  }

  // RON / RUM
  if (cat.includes('RON') || cat.includes('RUM')) {
    return {
      marca: extractMarca(name),
      uva: 'Caña de azúcar o melaza seleccionada',
      alc: '37.5–40%',
      anejo: 'Maduración en barricas de roble americano ex-bourbon en clima tropical',
      temp: 'Temperatura ambiente o con hielo, también en cócteles',
      color: 'Dorado ámbar (añejo) o cristalino (blanco)',
      aromas: 'Melaza, caña dulce, vainilla, coco, frutas tropicales, especias caribeñas',
      sabor: 'Dulce y suave, con notas de caña y especias, cuerpo medio, final cálido y agradable.',
      maridaje: 'Postres de coco, frutas tropicales, cerdo asado, mojito, daiquiri',
      nota: `Ron elaborado en el Caribe siguiendo las tradiciones destileras de la región. El clima tropical acelera el proceso de maduración, concentrando los sabores y aromas en menos tiempo que en climas fríos. Perfecto tanto para disfrutar solo como en los cócteles más icónicos del mundo.`
    };
  }

  // GIN
  if (cat.includes('GIN')) {
    return {
      marca: extractMarca(name),
      uva: 'Alcohol de grano con enebro y botánicos seleccionados',
      alc: '40–47%',
      anejo: 'Maceración y destilación con botánicos premium',
      temp: 'Muy frío con tónica, o en cócteles clásicos',
      color: 'Cristalino e incoloro',
      aromas: 'Enebro prominente, cítricos, flores, especias, hierbas aromáticas',
      sabor: 'Seco, con enebro al frente, notas cítricas y herbales, final refrescante y limpio.',
      maridaje: 'Pepino, queso de cabra, salmón, Gin Tonic con tónica premium',
      nota: `Gin elaborado con una cuidadosa selección de botánicos que equilibran el enebro tradicional con ingredientes únicos. El proceso de maceración y destilación extrae lo mejor de cada botánico, creando una bebida de gran complejidad aromática perfecta para los amantes del Gin.`
    };
  }

  // VINO TINTO
  if (cat.includes('VINO TINTO') || cat.includes('TINTO')) {
    return {
      marca: extractMarca(name),
      uva: 'Cabernet Sauvignon / Malbec / Tempranillo',
      alc: '13–14.5%',
      anejo: '8–12 meses en barrica de roble francés o americano',
      temp: '16–18°C (sacar 20 min antes del congelador)',
      color: 'Rojo rubí intenso con reflejos violáceos en joven, teja en añejo',
      aromas: 'Frutas rojas (cereza, ciruela, frambuesa), especias (pimienta, canela), notas de roble y vainilla',
      sabor: 'Taninos presentes pero suaves, buen cuerpo, acidez equilibrada, final persistente con notas frutales y especiadas.',
      maridaje: 'Carnes rojas a la parrilla, pasta con salsa de tomate, quesos curados, cordero',
      nota: `Vino tinto elaborado con uvas cuidadosamente seleccionadas en su punto óptimo de madurez. Su crianza en barrica de roble le aporta complejidad y estructura, integrando los taninos con las notas frutales del varietal. Ideal para acompañar una buena cena o disfrutar en compañía.`
    };
  }

  // VINO BLANCO
  if (cat.includes('VINO BLANCO') || cat.includes('BLANCO')) {
    return {
      marca: extractMarca(name),
      uva: 'Chardonnay / Sauvignon Blanc / Riesling',
      alc: '12–13.5%',
      anejo: 'Sin crianza o 4–6 meses en barrica de roble (según estilo)',
      temp: '8–10°C (copa de vino blanco)',
      color: 'Amarillo pálido con reflejos verdosos, brillante y limpio',
      aromas: 'Frutas blancas (manzana, pera, durazno), flores, cítricos, notas minerales',
      sabor: 'Fresco y ligero, buena acidez, frutal, final corto y refrescante.',
      maridaje: 'Mariscos, pescados blancos, ensaladas, quesos frescos, pasta con crema',
      nota: `Vino blanco fresco y aromático, elaborado preservando la frescura y los aromas varietales mediante vinificación a baja temperatura. Perfecto como aperitivo o para acompañar platillos ligeros del mar y la huerta. Servir bien frío para apreciar todo su potencial.`
    };
  }

  // CERVEZA
  if (cat.includes('CERVEZA') || cat.includes('BEER')) {
    return {
      marca: extractMarca(name),
      uva: 'Malta de cebada, lúpulo, levadura y agua',
      alc: '4.5–5.5%',
      anejo: 'Fermentación y maduración en frío (lager) o temperatura ambiente (ale)',
      temp: '3–6°C en vaso bien frío o tarro',
      color: 'Dorado brillante con espuma blanca cremosa',
      aromas: 'Malta dulce, lúpulo floral, notas de cereal, ligero cítrico',
      sabor: 'Refrescante, cuerpo ligero-medio, amargor moderado del lúpulo, final limpio y seco.',
      maridaje: 'Pizza, alitas, tacos, botanas, mariscos, hamburguesas',
      nota: `Cerveza elaborada siguiendo un meticuloso proceso de malteado, maceración, fermentación y maduración. Su equilibrio entre malta dulce y amargor del lúpulo la convierte en una de las bebidas más disfrutadas del mundo, perfecta para cualquier ocasión social.`
    };
  }

  // DEFAULT genérico para bebidas no identificadas
  return {
    marca: extractMarca(name),
    uva: 'Ingredientes seleccionados de origen controlado',
    alc: '38–43%',
    anejo: 'Proceso de elaboración supervisado por maestros destiladores',
    temp: 'Temperatura ambiente o según preferencia personal',
    color: 'Característico de su categoría',
    aromas: 'Aromas propios del destilado, notas de crianza, materia prima característica',
    sabor: 'Equilibrado y agradable, representativo de su categoría, con final persistente.',
    maridaje: 'Botanas variadas, quesos, embutidos, o disfrútalo solo',
    nota: `${name} es una bebida alcohólica de calidad elaborada siguiendo los más altos estándares de producción de su categoría. Su proceso de elaboración garantiza consistencia y calidad en cada botella, siendo una excelente opción para cualquier ocasión.`
  };
}
