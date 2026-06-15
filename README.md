# 🍷 Vinatería Etiquetas PRO v10

Generador de etiquetas con QR que abre ficha técnica en el celular del cliente.
Funciona para múltiples sucursales — **100% gratuito en Vercel**.

---

## Cómo funciona el QR

1. La app genera las etiquetas con fichas de cata
2. Cada ficha se guarda en **Vercel KV** (base de datos gratuita incluida en Vercel)
3. El QR impreso apunta a `tu-app.vercel.app/ficha.html?ficha=ID`
4. Cualquier cliente en cualquier celular escanea y ve la ficha técnica completa

---

## Deploy (10 minutos, gratis para siempre)

### Paso 1 — Subir a GitHub
1. Ve a github.com → New repository → nombre: `vinateria-etiquetas` → Private → Create
2. Sube todos los archivos de esta carpeta

### Paso 2 — Deploy en Vercel
1. Ve a vercel.com → Sign up with GitHub
2. Add New Project → selecciona `vinateria-etiquetas`
3. Framework: Other → Deploy

### Paso 3 — Activar Vercel KV ⚠️ SIN ESTO EL QR NO FUNCIONA
1. En tu proyecto Vercel → click **Storage** (menú superior)
2. **Create Database** → selecciona **KV** → nombre: `vinateria-kv` → Create & Continue
3. **Connect to Project** → selecciona tu proyecto → **Connect**
4. Vercel agrega las variables de entorno automáticamente

¡Listo! El QR de cada etiqueta abrirá la ficha en el celular de cualquier cliente.

---

## Estructura

```
├── package.json           ← Dependencia @vercel/kv
├── vercel.json            ← Rutas
├── api/
│   ├── scrape.js          ← Busca info del producto
│   ├── ficha-save.js      ← Guarda ficha en KV
│   └── ficha-get.js       ← Lee ficha desde KV
└── public/
    ├── index.html         ← App principal
    └── ficha.html         ← Página del cliente al escanear QR
```

## Límites gratuitos de Vercel KV
- 30,000 requests/mes (suficiente para cualquier vinatería)
- 256 MB de almacenamiento
- Las fichas expiran a los 90 días (se regeneran al reimprimir etiquetas)
