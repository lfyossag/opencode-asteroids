# AGENTS.md

Instrucciones para sesiones de OpenCode trabajando en este repo.

## Qué es

Clon de Asteroids en HTML5 Canvas + JavaScript vanilla, sin dependencias ni bundler. Toda la lógica vive en `game.js` (un solo archivo, ~420 líneas), cargado por `index.html`. Sin `package.json`, sin tests, sin lint, sin build.

## Cómo ejecutar

Abre `index.html` en el navegador, o sirve el directorio:

```bash
npx serve .
# http://localhost:3000
```

No hay pasos de build, install ni typecheck. Los cambios a `game.js` se ven recargando el navegador.

## Arquitectura

- `game.js` es un único módulo con `'use strict'` y globales. Clases: `Bullet`, `Asteroid`, `Ship`, `Particle`. Estado global mutado por `update(dt)`/`draw()`.
- Loop `requestAnimationFrame` con `dt` clampeado a 0.05s.
- Espacio toroidal: `wrap()` aplica envolvimiento de bordes en W=800 / H=600 (constantes hardcodeadas, no usar `canvas.width`).
- Input: `keys` (estado mantenido) y `justPressed` (edge detect vía `pressed()`) — distinguir ambos al maneñar disparo vs propulsión.
- Tamaños de asteroide: 3→2→1. Tablas `RADII`, `SPEEDS`, `POINTS` indexadas por size (índice 0 vacío).
- Estados: `'playing' | 'dead' | 'gameover'` en variable global `state`.

## Convenciones de estilo

- Estilo: sin punto y coma, comillas simples, 2 espacios, métodos de clase sin `function`.
- Comentarios de sección con `// ── Nombre ───...`.
- Render todo en stroke blanco `#fff` sobre fondo negro; el propulsor usa naranja.
- Mantener el archivo único: no extraer a módulos (no hay bundler/ES modules en uso).

## Gotchas

- **El README menciona power-ups y una "estrella fugaz" que NO están implementados en `game.js`.** Si se pide implementarlos, es net new; no existe código previo de referencia.
- `index.html` define estilos inline; el canvas se dimensiona a 800×600 fijos en el HTML. No asumir responsivo.
- `favicon.svg` existe pero es solo decorativo.