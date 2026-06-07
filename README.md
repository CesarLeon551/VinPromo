# 🍾 Vinatería Promo Labels

Sistema web para generar etiquetas promocionales de vinatería de forma automática a partir de archivos Excel.

El objetivo es facilitar la creación de promociones en anaquel, reduciendo tiempo de captura y manteniendo un diseño uniforme para toda la tienda.

---

## ✨ Características

* 📊 Importación de archivos Excel (.xlsx y .xlsm)
* 🏷️ Generación automática de etiquetas promocionales
* 💰 Cálculo automático de descuentos
* 🔥 Precio de oferta destacado
* ❌ Precio anterior tachado
* 📄 Exportación a PDF
* 👀 Vista previa antes de imprimir
* 🎨 Personalización de colores y promociones
* 🖼️ Soporte para logo de la tienda
* ✂️ Líneas de corte opcionales

---

## 📏 Formato de Etiqueta

Cada etiqueta se genera con medidas exactas de:

* Ancho: 6 cm
* Alto: 4 cm
* Orientación: Horizontal

Diseño optimizado para lectura rápida en anaqueles y exhibiciones.

---

## 📂 Formato del Excel

Columnas requeridas:

| Campo                    | Obligatorio |
| ------------------------ | ----------- |
| Descripción del producto | Sí          |
| Precio anterior          | Sí          |
| Precio oferta            | Sí          |

Columnas opcionales:

| Campo            |
| ---------------- |
| Marca            |
| Categoría        |
| Tamaño           |
| Código de barras |
| Imagen           |

Ejemplo:

| Descripción                | Precio Anterior | Precio Oferta |
| -------------------------- | --------------- | ------------- |
| Bacardí Carta Blanca 750ml | 259             | 199           |
| Smirnoff Vodka 750ml       | 199             | 159           |

---

## 🚀 Flujo de Uso

### 1. Subir Excel

Importa tu archivo con los productos en promoción.

### 2. Vista Previa

Visualiza las etiquetas antes de imprimir.

### 3. Generar PDF

Exporta una hoja tamaño carta con múltiples etiquetas listas para recortar.

---

## 🛠️ Tecnologías

### Frontend

* React
* TypeScript
* Tailwind CSS

### Librerías

* SheetJS (Lectura de Excel)
* PDF-lib (Generación de PDF)

---

## 🎯 Objetivo

Automatizar la creación de etiquetas promocionales para vinaterías, supermercados y tiendas de conveniencia, eliminando la edición manual de diseños y reduciendo errores en promociones.

---

## 📄 Licencia

MIT License

---

Desarrollado para optimizar la gestión de promociones y mejorar la presentación visual de productos en punto de venta.
