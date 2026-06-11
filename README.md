# 🍷 Vinatería Etiquetas PRO v8

Generador de etiquetas promocionales con fichas de cata automáticas.  
Funciona para **múltiples sucursales** desde una sola URL pública — **100% gratuito**.

---

## ¿Cómo funciona?

1. Subes tu Excel con productos y precios
2. La app busca información de cada producto en Wikipedia y fuentes públicas
3. Genera fichas técnicas de cata automáticamente
4. Exporta etiquetas en PDF con QR incluido — el cliente escanea y ve la ficha en su celular

---

## Deploy en Vercel (5 minutos, gratis para siempre)

### Paso 1 — Subir a GitHub

1. Ve a [github.com](https://github.com) → **New repository**
2. Nombre: `vinateria-etiquetas`
3. Visibility: **Private** (recomendado)
4. Click **Create repository**
5. Sube todos estos archivos:
   ```
   vinateria-vercel/
   ├── vercel.json
   ├── api/
   │   └── scrape.js
   └── public/
       └── index.html
   ```

Con GitHub Desktop o arrastrando los archivos al repositorio.

### Paso 2 — Conectar con Vercel

1. Ve a [vercel.com](https://vercel.com) → **Sign up with GitHub** (gratis)
2. Click **Add New Project**
3. Selecciona el repositorio `vinateria-etiquetas`
4. En configuración:
   - **Framework Preset**: Other
   - **Root Directory**: `vinateria-vercel`
   - Todo lo demás déjalo por defecto
5. Click **Deploy**

¡Listo! En 2 minutos tendrás una URL pública tipo:
```
https://vinateria-etiquetas.vercel.app
```

### Paso 3 — Compartir con sucursales

Comparte esa URL con todas las sucursales. Funciona en cualquier navegador, sin instalar nada.

---

## Actualizar la app

Cada vez que modifiques los archivos y los subas a GitHub, Vercel se actualiza automáticamente en segundos.

---

## Estructura del proyecto

```
vinateria-vercel/
├── vercel.json          ← Configuración de Vercel
├── api/
│   └── scrape.js        ← Función que busca info del producto (Wikipedia + DuckDuckGo)
└── public/
    └── index.html       ← La app completa (frontend)
```

---

## Fuentes de información usadas

- **Wikipedia API** — información general de marcas y productos
- **DuckDuckGo Instant Answers** — datos adicionales de productos
- **Base de conocimiento por categoría** — defaults inteligentes para tequila, whiskey, vino, etc.

Ambas APIs son **públicas y gratuitas**, sin límite de uso para este propósito.

---

## Soporte

Si la ficha de algún producto sale incompleta, puedes editarla manualmente en la app antes de generar el PDF.
