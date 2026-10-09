# Carom

A browser paddle duel about angles and momentum. Strike while moving to curve the ball, bank shots off two amber obstacles, and reach 11 with a two-point lead. Play against the computer in Solo or share a keyboard in Versus.

Everything is drawn and synthesized in code. The game runs locally, without accounts, a backend, external assets, or runtime network requests.

## Run

```sh
npm ci
npm run dev
```

Open the development URL printed by Vite.

```sh
npm run build
npm run preview
```

The production site is in `dist/`. Serve that directory at the root of any static web server.

## Controls

| Action | Controls |
| --- | --- |
| Solo paddle | W / S or ↑ / ↓ |
| Versus left paddle | W / S |
| Versus right paddle | ↑ / ↓ |
| Select menu item | W / S or ↑ / ↓; mouse or touch |
| Confirm | Enter / Space; click or tap |
| Pause / resume | P / Escape |
| Return from instructions | Escape |
| Toggle sound | M |
| Diagnostic overlay | Backtick |

Touch controls appear when you touch the screen. Motion at paddle contact adds spin; the ball's trail shows the resulting curve. Amber obstacles are solid, the top and bottom reflect, and the side edges score.

## Verification

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

Tests run the Simple 2D engine over a native canvas and controlled clocks, exercising menus, input, physics, serving, scoring, AI, and debug poses. The simulation builds a new state every frame; rendering and diagnostics only read it. Automation is available through `engine.debug` and `engine.apply` when constructing an engine with the exported `game`.

The player description, screenshots, and engine-recorded rally are in `showcase/`.
