# Iconos PWA/iPhone

Notas importantes para no repetir el problema de iconos blancos, SVGs incorrectos o rutas dinámicas que no cargan en iOS.

## Regla principal

Para los iconos instalables de Nexo hay que usar siempre **PNG estático real**, servido desde `public/`.

No usar SVG, rutas dinámicas de Next, PNG transparente ni el logo horizontal completo como icono PWA.

## Archivos correctos

Los iconos PWA/iPhone deben vivir como archivos reales en `public/`:

```txt
public/icon.png
public/apple-touch-icon.png
public/apple-touch-icon-precomposed.png
public/apple-touch-icon-180x180.png
public/favicon.png
public/icons/icon-192.png
```

El asset visual correcto es el icono cuadrado de Nexo:

- fondo blanco sólido;
- símbolo centrado;
- sin texto;
- sin transparencia problemática;
- PNG real, no SVG.

## `manifest.json`

El manifest debe apuntar al PNG estático:

```json
{
  "name": "Nexo",
  "short_name": "Nexo",
  "description": "Todo lo importante, conectado.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#f4f6fb",
  "theme_color": "#f4f6fb",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
```

## `layout.tsx`

La metadata debe apuntar también a archivos PNG estáticos:

```tsx
icons: {
  icon: [{ url: '/icon.png', sizes: '192x192', type: 'image/png' }],
  apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  shortcut: ['/icon.png'],
},
```

Y en el `<head>`:

```tsx
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="apple-touch-icon-precomposed" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="icon" type="image/png" sizes="192x192" href="/icon.png" />
<link rel="shortcut icon" type="image/png" href="/icon.png" />
```

## Qué no hacer

No volver a usar:

- `/nexo-pwa-final.png` como route handler;
- `/apple-touch-icon-final.png` como route handler;
- rutas Next que hagan `fetch('/icon.png')` para servir el icono;
- SVG como icono instalable;
- PNG con transparencia para Apple touch icon;
- el logo horizontal completo como icono PWA;
- cambios de cabecera/splash cuando solo se está arreglando PWA.

El problema concreto fue que iOS mostraba solo un recuadro blanco porque el icono se resolvía mediante rutas dinámicas o assets incorrectos. La solución que funcionó fue reemplazar directamente los archivos estáticos en `public/` y apuntar manifest + metadata a `/icon.png` y `/apple-touch-icon.png`.

## Procedimiento recomendado

1. Confirmar antes de tocar assets.
2. Cambiar una cosa cada vez.
3. Para binarios en GitHub, usar base64 solo como transporte interno de la herramienta, pero nunca dejar base64 en código.
4. En el repo debe quedar un `.png` real.
5. Esperar a que Vercel esté `READY` antes de probar.
6. En iPhone, probar desde Safari con “Añadir a pantalla de inicio”.
7. Si iOS cachea el icono, borrar el acceso directo anterior y repetir la instalación.

## Separación de marca

- Cabecera y splash: pueden usar el logo horizontal/lockup de Nexo.
- PWA/iPhone: debe usar solo el icono cuadrado con fondo blanco.
