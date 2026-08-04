# Rebranding: OzShop → Tiendify

El proyecto cambia de nombre y de identidad visual. Ahora se llama **Tiendify** y el dominio es tiendifyapp.com. Necesito que reemplaces el nombre, el logo y el color primario en todo el proyecto, de forma completa y consistente.

## Regla principal
Esto es un cambio de branding, NO de funcionalidad. No agregues features, no cambies lógica, no reestructures componentes. Solo reemplazá nombre, logo, colores y textos de marca. Si encontrás algo que se podría mejorar, no lo toques: limitate al rebranding.

## 1. Nombre

Reemplazá en TODO el proyecto:
- "OzShop" / "Ozshop" / "OZSHOP" / "Oz Shop" → **Tiendify**
- "OzEcom" / "Oz Ecom" → **Tiendify**
- Cualquier variante de nombre viejo que encuentres

Buscá y reemplazá en: componentes, páginas, textos de UI, metadatos, títulos, títulos de página (`<title>`), meta tags, Open Graph, README, package.json (name: "tiendify"), comentarios, nombres de variables o constantes que referencien la marca, textos del panel, emails o mensajes al usuario, y el manifest de la PWA si existe.

Dominio: tiendifyapp.com. Actualizá cualquier URL, canonical, Open Graph URL o referencia al dominio anterior.

## 2. Color primario

El nuevo color primario de marca es **azul cielo #0EA5E9** (es el "sky-500" de Tailwind).

Reemplazá el color primario anterior por esta paleta:
- Primario: `#0EA5E9` (sky-500)
- Primario oscuro / hover: `#0284C7` (sky-600)
- Primario claro / para fondos oscuros: `#38BDF8` (sky-400)
- Tints suaves para fondos: `#E0F2FE` (sky-100), `#F0F9FF` (sky-50)
- Texto oscuro de marca: `#0F172A` (slate-900)

Si el proyecto usa Tailwind, usá las clases `sky-*` (sky-500, sky-600, sky-400, sky-100, sky-50) en vez de definir hex sueltos, y actualizá la config de Tailwind si hay un color custom definido.

Aplicá el nuevo primario en: botones principales, links, estados activos, badges, bordes de foco, gráficos, íconos destacados, la barra de navegación, y cualquier acento de marca. Revisá que el contraste siga siendo accesible (texto blanco sobre #0EA5E9 funciona bien).

IMPORTANTE: el color primario de TIENDIFY (la plataforma) es distinto del color de cada TIENDA. Cada tienda (tenant) tiene su propio `primary_color` configurable, que NO se toca. Solo cambiás el color de la plataforma en sí: el panel de administración, la landing de Tiendify, el super-admin, los emails de la plataforma. Las tiendas públicas de los clientes siguen usando el color que cada dueño configuró.

## 3. Logo

El nuevo logo es una **etiqueta de precio** (un rombo/etiqueta con un agujerito), en azul cielo, junto al nombre "Tiendify" donde "Tiend" va en oscuro y "ify" en azul.

Te paso estos archivos SVG (guardalos en `/public/` o donde corresponda):
- `tiendify-logo-color.svg` — logo completo para fondos claros
- `tiendify-logo-white.svg` — logo completo para fondos oscuros
- `tiendify-symbol.svg` — solo el símbolo (etiqueta), para favicon
- `tiendify-app-icon.svg` + `tiendify-app-icon.png` — ícono cuadrado 512x512 para PWA

Reemplazá el logo anterior por estos en:
- Header / navbar del panel
- Sidebar
- Pantalla de login
- Landing de Tiendify
- Footer
- Favicon (usá el símbolo)
- Manifest de la PWA (ícono de app)
- Emails de la plataforma, si existen
- Open Graph image, si existe

Usá el SVG siempre que puedas (escala sin perder calidad). Los PNG solo donde no se admita SVG.

Si el logo se usa como componente React, actualizá el componente para que apunte al nuevo SVG y elegí automáticamente la versión clara u oscura según el fondo.

## 4. Textos de marca

Revisá y actualizá los textos que mencionen la marca:
- Títulos y subtítulos de la landing
- Mensajes de bienvenida
- Textos del onboarding
- Footer ("Tiendify" en vez del nombre viejo)
- Cualquier copy que diga el nombre anterior

Si en el footer o en algún lado corresponde, podés incluir "Un producto de OzAI" (Tiendify es un producto de la empresa OzAI), pero solo donde tenga sentido, no lo fuerces.

## 5. Verificación final

Cuando termines:
1. Hacé una búsqueda global (grep) de "OzShop", "Ozshop", "OzEcom", "Oz Ecom" para asegurarte de que no quedó ninguna referencia.
2. Hacé una búsqueda del color primario viejo (el hex que estaba usando) para asegurarte de que no quedó ninguno suelto.
3. Verificá que el proyecto compile y corra sin errores.
4. Revisá visualmente: landing, login, panel, y una tienda pública de ejemplo.

## Cómo proceder
Hacé el rebranding completo, y al terminar mostrame un resumen de: qué archivos tocaste, qué reemplazaste, y si encontraste algo ambiguo que necesite mi decisión. Si tenés dudas sobre dónde aplica el color de plataforma vs el color de cada tienda, preguntame antes de cambiar.
