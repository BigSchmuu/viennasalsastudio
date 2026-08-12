# Design System — Vienna Salsa Studio

Extracted from the existing marketing website (`/Users/samumamu/Documents/Programmieren/ViennaSalsaStudio`), so the app matches the studio's established brand.

## Colors

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#fbfbfd` | Page background (light) |
| `--bg2` | `#f6f7fb` | Secondary/section background |
| `--text` | `#0b1020` | Primary text (near-black navy) |
| `--muted` | `rgba(11,16,32,.68)` | Secondary/muted text |
| `--line` / `--border` | `rgba(11,16,32,.10–.12)` | Borders, dividers |
| `--salsa` | `#ff3b30` | **Primary brand color** (red) — CTAs, active states |
| `--mango` | `#ffb000` | **Secondary brand color** (gold/amber) — accents, highlights |
| `--berry` | `#7c5cff` | Optional tertiary contrast (purple) |
| `--card` | `rgba(255,255,255,.72–.78)` | Card backgrounds (glassmorphism) |

**Manifest brand color** (app icon / browser chrome): `#0b0b0b` (near-black)

### Course level colors
Used to color-code course cards by skill level — should carry over to course/booking UI:

| Level | Color |
|---|---|
| Beginner | `#2a9d8f` (teal) |
| Improver | `#457b9d` (blue) |
| Intermediate | `#e9c46a` (yellow) |
| Advanced | `#e63946` (red) |
| Open Level | `#8d5cf6` (purple) |

## Typography

- **Body text:** `Inter`, sans-serif, weight 400, `line-height: 1.6`, `letter-spacing: 0.2px`
- **Headlines (h1–h4):** `Raleway`, sans-serif, weight 700, `letter-spacing: -0.5px`
- **Hero title:** Raleway, weight 800, `clamp(2.5rem, 5vw, 4rem)`, `letter-spacing: -1px`
- **Nav links:** Inter, weight 600, uppercase, `letter-spacing: 0.8px`, `13px`
- **Buttons:** Inter, weight 700, `letter-spacing: 0.6px`

Both fonts are available on Google Fonts — use `next/font/google` for Inter + Raleway instead of self-hosted `.woff2` files.

## Visual Style

- **Look & feel:** Light theme, glassmorphism — translucent cards (`rgba(255,255,255,.72–.78)`) with backdrop blur (`blur(10px)`) over soft gradient backgrounds
- **Shadows:** Soft, large-blur shadows — e.g. `0 18px 55px rgba(13,18,40,.12)` and `0 8px 22px rgba(13,18,40,.08)`
- **Corners:** Generously rounded — `26px` radius on cards/sections
- **Motion:** `scroll-behavior: smooth`

## Notes for `/frontend`

- Map these tokens to Tailwind theme colors (`salsa`, `mango`, `berry`) and to shadcn/ui CSS variables where equivalent (e.g. `--primary` → `--salsa`).
- Reuse the level-color convention for any course/class-level badge or card accent.
- The marketing site is light-only; no dark mode tokens exist yet — default to light theme for the app unless the studio wants dark mode added later.
