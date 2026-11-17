# Design system

Source of truth: CSS custom properties in `FRONTEND/src/styles/index.css`. Components reference tokens, not raw values. Theme is set by `body[data-theme="light|dark"]` (see `ThemeContext`, persisted in `localStorage` as `csb-theme`).

## Color
- Primary: indigo `#3f51d6` (hover `#3443c0`). Brand text on dark: `#8b9bff`.
- Dark surfaces: deep indigo-slate `#0f1220` / `#141830` / `#1a1f3a`; cards `#1d2342`.
- Light surfaces: `#f4f5fb` / `#eceef8` / `#e3e6f4`; cards `#ffffff`.
- Accent: green `#34b38a` (success, online). Danger `#ff5d76`. Warning `#ffb347`.
- Body text and placeholders must hold 4.5:1 contrast.

## Typography
- Body: Manrope. Display and headings: Sora.
- Scale (`--text-xs` to `--text-3xl`): 0.75, 0.875, 1, 1.125, 1.375, 1.75, 2.25 rem.

## Shape and depth
- Radius: 8 / 12 / 16 / 20 px and full (`--radius-sm` to `--radius-full`). No giant radii on large surfaces.
- Shadows have offset and soft blur; no zero-offset glows, no hard offset shadows.

## Motion
- `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`. Durations 150 to 400 ms. One authored moment per screen.
- Reduced motion disables animation globally.

## Layers (`--z-*`)
base 1, sticky 50, navbar 120, dropdown 200, overlay 300, modal 400, toast 500.

## Layout
- Desktop: fixed top bar with primary navigation, content column up to 1220 px.
- At 768 px and below: compact top bar (brand, search, theme), bottom navigation (Home, Chat, Groups, Alerts, More), "More" bottom sheet for Profile, Marketplace, Forums, Blogs and Log out. Body reserves `--bottom-nav-height`.

## Time
All dates go through `FRONTEND/src/utils/time.js` and render in Asia/Dhaka.
