# WYRM → reframed.online — Полный план редизайна

> Сгенерировано многоагентным анализом (13 агентов): извлечён дизайн-язык reframed.online из его CSS-бандлов, снята карта всего кода WYRM (src/app.jsx 4137 строк, styles.css, lib, pocketbase, realtime), синтезирован план на каждый компонент, UI/UX, логику пользователя и весь бэкенд.

**Дата:** 2026-06-23 · **Цель:** монохромный brutalist-editorial / Swiss-typographic / terminal-lab язык reframed.online на каждом экране, ровно и с движением.

---

## ✅ Зафиксированные решения (архитектор, 2026-06-23)

| # | Решение | Выбор |
|---|---------|-------|
| **D1** Дисплейный шрифт | замена Unhuman | **Space Grotesk** (free OFL, self-host woff2) + Inter/Helvetica для UI |
| **D2** Цвет | строгость монохрома | **Полный монохром** — удалить все 5 ACCENTS и genre `hue`; канон = вес + маркер `★`, не цвет |
| **D4** WebGL-звёзды | starfield | **CSS-only слой звёзд** (без WebGL); делается в фазе **P7**, гасится при `prefers-reduced-motion` |
| **D5** Бэкенд-сёрфейсинг | объём цикла | **Tier 1+2** — zero-backend (граф связей, REP HUD, deep-links, тикер) + мелкие store-добавления (закладки, reader_cuts, media, верификация). `merge_requests`/`room_turn` сервер — отложены |

**Каскадные следствия (вытекают из D2):** D3 — оставляем режимы **Бумага + Инверсия**, удаляем Night/Manuscript и массив `ACCENTS`. D6 — hue-слайдер в `CommunityCreate` **удаляется** (баннеры grayscale). D7 — serif в Reader: **opt-in, выключен по умолчанию**. D8 — пикер `FONTS` **удаляется** (одна шрифтовая система).

> Эти решения перекрывают рекомендации в Разделе 6 §2 (там D4 был «пропустить» — обновлено на «CSS-only слой»).

---

## Оглавление

1. [Дизайн-система и движение](#1)
2. [Бэкенд-сёрфейсинг и логика пользователя](#2)
3. [Экраны — Story Core (Gate / Catalog / Tree / Reader / Compose)](#3)
4. [Экраны — Social (Feed / Communities / Profile / Auth / Menus)](#4)
5. [Экраны — Studio / Plugins / Settings / Shell](#5)
6. [Дорожная карта внедрения, решения, риски](#6)

---


<a id="1"></a>

# Раздел 1. Дизайн-система и движение

# WYRM → reframed.online — Global Design-System Redesign Spec

> Retargets WYRM's two-world `oklch` theme system and colored accents onto reframed.online's monochrome brutalist-editorial / Swiss-typographic language. Implementation-ready: every value is a literal you can paste into `src/styles.css` and the JS `ACCENTS`/`FONTS`/config-apply effect.

---

## 0. Design thesis (what changes conceptually)

| Today (WYRM) | Target (reframed) |
|---|---|
| Two *worlds* (Night ember/jade, Manuscript parchment/oxblood) | Two *modes of one world* — **Paper** (black-on-white) and **Inverted** (white-on-black). Same ink, flipped. |
| 5 colored ACCENTS user-selectable | **One ink.** Color is dropped from the system; "accent" becomes a single optional near-black ink (`--ink`). Genre `hue` dots survive only as the *one* permitted spot of color (tiny mood dots), or are converted to grayscale — see §1.4. |
| Serif body (Lora) + Onest display | **Helvetica/grotesque everywhere.** Display = tight grotesque substitute for Unhuman; UI/body = Helvetica Neue stack; mono = SFMono. Serif retired (kept only as an optional reading-mode opt-in, §2.5). |
| Glow shadows, soft blur cards, gold canon halos | Hairline rules, flat surfaces, **invert-on-hover**, film grain, blink cursors. No glow, no colored shadow. |

The Gate already half-speaks this language; the job is to push the *same* taste evenly into every screen.

---

## 1. COLOR

### 1.1 Decision: drop chromatic color; keep one ink

Replace the entire `oklch` palette with neutrals. There is exactly **one** semantic ink (`--ink`, near-black `#262626`) and pure extremes (`#000`, `#fff`). No jade/ember/oxblood/gold. "Accent" and "gold" tokens are **kept as aliases that resolve to ink** so existing component code (`var(--accent)`, `var(--gold)`) keeps compiling without a sweep — they just stop being colorful. Canon, which was gold, is now distinguished by **weight + rule + a filled marker**, not hue (§5.4).

### 1.2 Token set — Paper mode (default, `:root` / `[data-theme="paper"]`)

```css
:root,
[data-theme="paper"] {
  color-scheme: light;

  /* surfaces */
  --bg:        #ffffff;   /* page */
  --bg-2:      #fafafa;   /* raised panel */
  --bg-3:      #f2f2f0;   /* sunken / placeholder stripes */
  --panel:     #ffffff;   /* cards: opaque, no blur */
  --paper:     #ffffff;

  /* ink */
  --ink:       #262626;   /* primary text (reframed near-black) */
  --ink-2:     #595959;   /* secondary */
  --ink-3:     #8c8c8c;   /* muted labels / eyebrows */
  --ink-max:   #000000;   /* pure black, headlines + rules */

  /* lines (hairlines) */
  --line:      rgba(38,38,38,.18);
  --line-soft: rgba(38,38,38,.09);
  --line-hard: #262626;     /* full-weight rule */

  /* accent + gold collapsed to ink (compat aliases) */
  --accent:         var(--ink-max);
  --accent-default: var(--ink-max);
  --accent-ink:     #ffffff;   /* text on inked fill */
  --gold:           var(--ink-max);
  --gold-default:   var(--ink-max);

  /* effects */
  --grain-opacity: 0.05;
  --invert-amt:    100%;      /* backdrop-filter:invert() strength */
  --node-glow:   none;        /* glow retired → flat */
  --canon-glow:  none;        /* canon shown by border/marker, not halo */
  --hero-veil:   none;
  --shadow-card: none;        /* flat; rules do the separating */
  --rule-style:  1px solid var(--line);
  --rule-hard:   1px solid var(--line-hard);
}
```

### 1.3 Token set — Inverted mode (`[data-theme="inverted"]`)

Pure flip — same names, swapped values. This *replaces* the old "Night" theme.

```css
[data-theme="inverted"] {
  color-scheme: dark;

  --bg:        #000000;
  --bg-2:      #0a0a0a;
  --bg-3:      #161616;
  --panel:     #000000;
  --paper:     #000000;

  --ink:       #e8e8e8;
  --ink-2:     #a6a6a6;
  --ink-3:     #6b6b6b;
  --ink-max:   #ffffff;

  --line:      rgba(232,232,232,.20);
  --line-soft: rgba(232,232,232,.10);
  --line-hard: #e8e8e8;

  --accent:         var(--ink-max);
  --accent-default: var(--ink-max);
  --accent-ink:     #000000;
  --gold:           var(--ink-max);
  --gold-default:   var(--ink-max);

  --grain-opacity: 0.07;
}
```

**Theme map rename:** the SettingsDrawer "Мир оформления" tiles `['night','manuscript']` → `['paper','Бумага','sun'], ['inverted','Инверсия','moon']`. `setTheme` writes `data-theme="paper|inverted"`. Default route loads `paper`. The Gate's self-contained `--g-*` palette (`#F1F0EC`/`#14110f`) is already on-language — keep it, but align `--g-bg` to `#ffffff` and `--g-ink` to `#262626` for consistency with the rest of the app (optional; the warm off-white is acceptable as a Gate-only signature).

### 1.4 The colored ACCENTS array — removed

The 5-entry `ACCENTS` table (jade/ember/indigo/gold/theme) is **deleted**. The "Акцентный цвет" Field in SettingsDrawer is removed entirely. The config-apply effect stops writing `--accent`/`--gold` overrides (they now resolve to ink via the cascade). This is the single biggest semantic change — surface it to the user as a deliberate choice.

### 1.5 Genre `hue` — the one allowed concession

`Tag`, `CommunityCard` banners, `GenreWheel`, mood dots all derive color from `oklch(0.7 0.16 <hue>)`. Two options — **recommend Option A**:

- **Option A (purist, recommended):** convert all `hue`-derived fills to neutral. `Tag` dot becomes a `6px` solid `var(--ink)` square (not a colored circle); `GenreWheel` sectors fill `--ink` at varying *alpha* (0.22 idle / 0.55 hover / 0.95 selected) — selection reads through alpha + the pop-out, no hue. `CommunityCard`/`CommunityDetail` banners become grayscale `repeating-linear-gradient` (see CoverSlot §5.5).
- **Option B (one spot of color):** keep the genre dot as the *only* chromatic element in the whole app — a single 5–6px colored pip — and grayscale everything else. Defensible "lab tag" accent, but breaks strict monochrome.

Pick A unless the user wants a vestige of color for genre legibility.

---

## 2. TYPE

### 2.1 Faces

| Role | Face | Stack | Source |
|---|---|---|---|
| **Display** (giant wordmarks, page titles) | **Space Grotesque** primary; fallback **Archivo Expanded** / system grotesque | `'Space Grotesk', 'Archivo', 'Helvetica Neue', Arial, sans-serif` | Space Grotesk — free, OFL (Google Fonts). Tight, slightly mechanical grotesque; closest free analog to Unhuman's tight modern display. Self-host woff2. |
| **UI / body** | **Helvetica Neue** (Swiss) | `'Helvetica Neue', Helvetica, Arial, 'Inter', sans-serif` | System on macOS/iOS; `Inter` self-hosted as the cross-platform substitute where Helvetica is absent (Inter at `-0.011em` reads near-Helvetica). |
| **Mono** | **SFMono / JetBrains Mono** | `'SFMono-Regular', 'JetBrains Mono', ui-monospace, Menlo, monospace` | Keep the already-loaded JetBrains Mono as the cross-platform fallback for SFMono. |

> Licensing note for the user: **Unhuman is proprietary** — Space Grotesk (OFL) is the recommended free substitute. If budget exists, the closest licensable commercial faces to Unhuman's flavor are *PP Neue Montreal* or *Söhne* (display weights). The spec below assumes Space Grotesk.

**`@font-face` action:** the existing 763 lines of Onest/Lora/JetBrains `@font-face` declarations shrink dramatically — drop all Onest and all Lora weights; add Space Grotesk (400/500/700) and Inter (400/500/700). Keep JetBrains Mono.

### 2.2 Root font vars (replace lines 767–769)

```css
--display: 'Space Grotesk', 'Archivo', 'Helvetica Neue', Arial, sans-serif;
--ui:      'Helvetica Neue', Helvetica, Arial, 'Inter', sans-serif;
--serif:   var(--ui);   /* serif retired → body now uses Helvetica */
--mono:    'SFMono-Regular', 'JetBrains Mono', ui-monospace, Menlo, monospace;
```

`body { font-family: var(--ui); line-height: 1.5; }` (was serif/1.62).

### 2.3 Fluid display scale (mapped to reframed's 159/85/73/64/48 + their calc curves)

reframed's signature fluid sizes, ported to `clamp()` with matching `vw` slopes:

```css
/* Display tier — Space Grotesk, weight 400/700, tight tracking */
--fs-d1: clamp(64px, 8.28vw, 159px);              /* hero wordmark (reframed 8.28125vw / 159px) */
--fs-d2: clamp(48px, calc(1.5625vw + 36px), 85px);/* page-head-title */
--fs-d3: clamp(40px, calc(3.125vw + 22px), 73px); /* section headers */
--fs-d4: clamp(34px, 5vw, 64px);                  /* card / flagship titles */
--fs-d5: clamp(28px, 4vw, 48px);                  /* sub-display */

/* Reading / heading mid-tier */
--fs-h1: clamp(26px, 3.2vw, 40px);
--fs-h2: clamp(21px, 2.4vw, 28px);
--fs-h3: 18px;
--fs-body: 16px;
--fs-read: 18px;        /* article column */

/* UI / label tier — Helvetica + mono, reframed's tiny sizes */
--fs-ui:    15px;
--fs-ui-sm: 14px;
--fs-meta:  12px;       /* THE most common reframed size */
--fs-micro: 11px;       /* mono codes / timestamps */
```

### 2.4 Tracking / case / weight rules

| Tier | font | weight | letter-spacing | case | line-height |
|---|---|---|---|---|---|
| Display d1–d3 | display | 400 (or 700 sparingly) | **−0.0208em** (tight, reframed `-.0208em`) | as-authored | **0.9** |
| Display d4–d5 | display | 700 | −0.014em | — | 1.0 |
| h1–h2 | display | 700 | −0.011em | — | 1.1 |
| h3 / strong UI | ui | 700 | −0.006em | — | 1.2 |
| Body / read | ui | 400 | 0 (`−0.003em` for Inter) | — | 1.5 (read 1.6) |
| `.mono` label | mono | 500 | **+0.08em** | **UPPERCASE** | 1.25 |
| `.eyebrow` | mono | 500 | **+0.2em** | **UPPERCASE** | 1.3 |
| `.code` | mono | 500 | +0.14em | UPPERCASE | 1.2 |

`.display` helper updates: `font-weight:400; line-height:.9; letter-spacing:-0.0208em; text-wrap:balance;` (drop the `ss01/cv01` Onest features). Reserve 700 for emphasis, not default headings — reframed leans 400 for the giant type.

### 2.5 Serif retirement

`.serif` / `.serif-italic` / `rich-read` / `rich-edit` body currently use Lora. Remap `--serif → var(--ui)` so they fall back to Helvetica automatically. **Optional reading opt-in:** keep a `body.reading-serif` class that re-points `--serif` to a licensed serif for users who want it in the Reader only — but it is off by default and out of the core monochrome look.

---

## 3. SPACE / GRID / RULES

### 3.1 Spacing scale (new — none exists today)

8px base, with sub-steps for hairline-tight editorial gaps:

```css
--sp-0: 0;     --sp-1: 4px;   --sp-2: 8px;   --sp-3: 12px;
--sp-4: 16px;  --sp-5: 24px;  --sp-6: 32px;  --sp-7: 48px;
--sp-8: 64px;  --sp-9: 96px;  --sp-10: 128px; --sp-11: 192px;
```

**Negative-space rhythm:** reframed is generous. Section vertical padding = `clamp(var(--sp-8), 9vw, var(--sp-11))` (64→192px). Card internal padding tightens to `--sp-5` (24px). Between a label and its content: `--sp-2`. The page wants *air* + hairlines, not boxes-in-boxes.

### 3.2 Radius — flatten

reframed is square. Override the appended radius tokens:

```css
--r-card: 0px;   /* was 14px — cards become hairline rectangles */
--r-btn:  0px;   /* was 10px */
--r-pill: 0px;   /* tags lose their 999px pill */
--r-input: 0px;
```

(If a hint of softness is desired, `2px` max anywhere — never the old 14px.)

### 3.3 Hairline rules

A *rule* is the primary structural device (replacing shadows/glow):

```css
--rule-style: 1px solid var(--line);       /* hairline divider */
--rule-hard:  1px solid var(--line-hard);  /* full-ink section rule */
```

Cards: `border: var(--rule-style); box-shadow:none; background:var(--panel);`. Section dividers: a single `--rule-hard` top border. The `.card.framed` double-rule (manuscript illuminated-codex) becomes a simple **outer hairline + 4px inset second hairline** in pure ink — a Swiss frame, not gilt.

### 3.4 Grid + breakpoints

Keep `--maxw: 1240px`, `.wrap = min(100% - 48px, var(--maxw))`. Adopt reframed's breakpoints exactly:

```css
/* 480 / 800 / 1140 / 1440 / 1920 */
@media (max-width: 480px)  { :root { --maxw: 100%; } .wrap { width: min(100% - 24px, 100%); } }
@media (min-width: 800px)  { /* 2-col reader/compose grids engage here, not 940 */ }
@media (min-width: 1140px) { /* full editorial 12-col available */ }
@media (min-width: 1440px) { :root { --maxw: 1320px; } }
@media (min-width: 1920px) { :root { --maxw: 1440px; } }
```

Reader/compose two-column grids (`reader-grid`, `compose-grid`) currently collapse ≤940px — retarget the collapse to **800px** to match the breakpoint set. Rail widths unify: pick **340px** for all studio rails (currently 320/340 mixed).

12-column reference grid (`--col: calc((100% - 11*var(--sp-4)) / 12)`) available for editorial layouts; most screens stay on the existing `minmax(0,1fr) 340px` rail pattern.

---

## 4. MOTION

### 4.1 Easing + transition tokens

```css
--ms-color: 125ms;                              /* reframed color/bg hovers */
--ease-color: ease-out;
--ease-snap: cubic-bezier(.55,.085,.68,.53);    /* reframed snappy easeIn */
--t-snap: .2s var(--ease-snap);                 /* all-purpose UI transition */
--ease: cubic-bezier(.22,.61,.36,1);            /* keep for page-in */
```

Replace the existing `--ease-out` reveal curve usage on interactive hovers with the two reframed curves:
- **Color/background hover:** `transition: color var(--ms-color) var(--ease-color), background-color var(--ms-color) var(--ease-color), border-color var(--ms-color) var(--ease-color);`
- **Transform/size/everything-else:** `transition: var(--t-snap);`

### 4.2 Invert-on-hover (the signature trick)

The defining reframed interaction. Apply to buttons, nav corners, tags, cards-as-buttons, story-cards:

```css
.invert-hover { position: relative; }
.invert-hover::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  backdrop-filter: invert(var(--invert-amt));
  -webkit-backdrop-filter: invert(var(--invert-amt));
  opacity: 0; transition: opacity var(--ms-color) var(--ease-color);
}
.invert-hover:hover::after,
.invert-hover:focus-visible::after { opacity: 1; }
```

Use on: `.btn`, `.gate-corner`, `.tag-btn`, `.story-card`, `.nav-link`, `.mobile-link`, `.studio-item`, `.plug-tab`, `.swatch-tile`. For elements where a full invert is too aggressive (large cards), fall back to a **flat ink-fill swap**: `:hover { background:var(--ink-max); color:var(--accent-ink); }` over `--ms-color`. `.btn-primary` is already inked — on hover it inverts to outline (transparent bg, ink border + ink text).

`mix-blend-mode: difference` is the alternative for overlay labels sitting on imagery (e.g. CoverSlot caption) so text stays legible against any value.

### 4.3 Film grain

Keep both grain layers (`.atmos::after`, `.gate-grain`) — they're already on-language. Bump base presence and ensure it rides every screen (atmos is always rendered). Add an **animated** variant for the "lab" vibe (reframed's `@keyframes noise`):

```css
@keyframes noise {
  0%,100% { transform: translate(0,0); }
  10% { transform: translate(-2%, -3%); }
  30% { transform: translate(3%, -2%); }
  50% { transform: translate(-1%, 2%); }
  70% { transform: translate(2%, 1%); }
  90% { transform: translate(-3%, 2%); }
}
.atmos::after { animation: noise .5s steps(4) infinite; opacity: var(--grain-opacity); mix-blend-mode: overlay; }
```

### 4.4 Terminal blink cursor accents

Keep `@keyframes blink` (`.caret`, 0.25s steps). Extend the terminal-lab vibe: append a blinking block cursor to live/editorial labels — e.g. the Gate eyebrow, live-badge, WritersRoom buffer, section eyebrows can end with `<span class="blink">▋</span>`:

```css
.blink { animation: blink .25s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }
```

`.live-badge` dot drops its colored pulse → becomes a black blinking square.

### 4.5 Page / route transitions

No history stack exists, and `go()` does `scrollTo`. Add a crossfade/grain-wipe between routes via a wrapper on `.view`:

```css
.view { animation: viewIn .32s var(--ease) both; }
@keyframes viewIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
```

Optional brutalist touch: a 1-frame full-bleed `invert(100%)` flash on route change (a `.route-flash` element toggled in `go()`, animating opacity 0→1→0 over 180ms) — reads as a "camera cut." Gate behind reduced-motion.

### 4.6 Reduced motion

Keep the global kill-switch (`prefers-reduced-motion: reduce` → all durations `.001ms !important`). Additionally, **disable** grain `noise` animation, `blink`, the route-flash, and gate parallax under reduce — grain stays static (not animated), cursor stays solid, invert-on-hover still works (it's instantaneous opacity, fine to keep but make it non-animated).

---

## 5. PRIMITIVES RESTYLE

### 5.1 Buttons

| Variant | Paper look | Hover |
|---|---|---|
| `.btn` | transparent bg, `1px solid var(--line-hard)`, `--ink-max` text, square, `--fs-ui-sm`, mono-ish UI font, `padding: 10px 18px`, no radius | invert-on-hover (bg→ink, text→paper) over `--ms-color` |
| `.btn-primary` | inked: `background:var(--ink-max)`, `color:var(--accent-ink)`, no border | invert to outline (transparent bg, ink border+text) |
| `.btn-ghost` | no border, `--ink-2` text, underline-on-hover via `::after` scaleX | text→`--ink-max` + underline reveals |
| `.btn-sm` | `--fs-meta`, `padding: 6px 12px` | same |
| `.icon-btn` | 36×36, square, `1px solid var(--line)` | invert-on-hover |

All buttons lose `--r-btn` rounding and any colored fill. Active state: no scale; a 1px inset shift instead.

### 5.2 Forward / Back nav control (the redesign gap)

Today there's no back affordance except brand→landing. Introduce a **persistent corner nav control** in the reframed idiom — a fixed top-left `.navctl` cluster on every non-Gate route:

```
[ ← НАЗАД ]   ·   WYRM / <route label>
```

- `.navctl-back` — a `.btn`-style hairline button, label `← НАЗАД` in `.mono` uppercase, invert-on-hover. Wire a lightweight history: push each `go()` target onto a `routeStack` array in App; back pops it (this fills the "no history" gap noted in the inventory). When stack empty → label `← ВОРОТА`, returns to `landing`.
- `.navctl-crumb` — `.mono --fs-meta` `WYRM · <current route label>`, the `WYRM` part invert-on-hover → `go('landing')`.
- Forward isn't user-facing (no forward stack needed); the corner stays back-only.

Burger stays top-right (already the only nav trigger). This gives every screen a consistent back, replacing the per-screen ad-hoc crumbs (Merge's `← древо`, CommunityDetail's `← все сообщества`) with one global control — keep the screen-specific crumbs as secondary in-content links if desired, but the corner control is canonical.

### 5.3 Icon

Keep the 24×24 stroke SVG set — it's already monochrome `currentColor`. Reduce `stroke` from 1.6 → **1.25** for a finer, more technical line that matches hairline rules. No fills. Icons inherit invert-on-hover from their container.

### 5.4 Tag

- Square (`--r-pill: 0`), `1px solid var(--line)`, `--fs-meta`, mono UPPERCASE label.
- **Dot** → a `6px` solid square `var(--ink)` (Option A) instead of a colored circle.
- `data-active`: filled — `background:var(--ink-max); color:var(--accent-ink); border-color:var(--ink-max)`.
- `.tag-btn` adds invert-on-hover.

### 5.5 Avatar, CoverSlot, banners

- **Avatar:** keep the monogram, but `border-radius:0` (square), `1px solid var(--line)`, mono initial, `background:var(--bg-3)`. Squares read more "lab/index-card" than circles.
- **CoverSlot:** drop the hue radial glow. Placeholder = `repeating-linear-gradient(135deg, var(--bg-2) 0 8px, var(--bg-3) 8px 16px)` (grayscale diagonal hatch) + centered mono label in `--ink-3`. With `src`: `filter: grayscale(1) contrast(1.05)` so user images join the monochrome system; on hover, `filter:none` (or invert) to reveal — a nice reframed reveal beat.
- **Community banners** (`CommunityCard`/`CommunityDetail`): replace `hue` gradients with the same diagonal hatch; community name in large display, `mix-blend-mode:difference` so it survives the hatch.

### 5.6 CanonMeter, StatusPill, StoryTree (canon-without-gold)

Canon was carried by **gold**; now it's carried by **rule weight + fill + marker**.

- **CanonMeter:** track = `var(--line-soft)`, fill = `var(--ink-max)` always (no gold/accent split). Canon vs non-canon distinguished by the numeric label weight and an adjacent `★`/`КАНОН` mono tag, not color. Keep `transition: width 1s`.
- **StatusPill:** drop `oklch(...hue...)`. All statuses use ink on `--bg-3` with a `1px solid var(--line)`; differentiate by **glyph + label** only (Жив `●` outline, Мёртв `✕`, Пропал `?`, Изменён `≠`), mono `--fs-micro` UPPERCASE.
- **StoryTree:**
  - Edges: canon edge = `--line-hard` **2px solid**; hover/selected path = `--ink-max` 2px; idle = `--line` 1px. (Was gold/accent.)
  - `.tnode`: square, `1px solid var(--line)`; **canon node** = `2px solid var(--ink-max)` + a filled `★` corner marker; **selected** = `2px solid var(--ink-max)` + 2px inset second rule (the Swiss double-frame) instead of accent ring; dimmed non-matching nodes stay `opacity:.26`. No `--node-glow`/`--canon-glow` (both → `none`).
  - `.fork-mini`, `.path-crumb`: hairline, invert-on-hover.

### 5.7 Inputs / editor

`.compose-input`, `.auth-input`, `.range`, `.rich-edit`, `.edit-tool`:
- Square, `1px solid var(--line)`, `background:var(--bg)`, `--ink` text, mono placeholder in `--ink-3`.
- Focus: border → `--ink-max` (no glow ring), `--ms-color` transition.
- `.range` thumb: square `12×12` `var(--ink-max)`, square track `var(--line)`.
- `.toggle`: square track `1px solid var(--line)`; `data-on` → `background:var(--ink-max)`, knob (`--accent-ink`) slides; no colored state.
- `.swatch-tile` / `.plug-tab` / `.nav-link` active: ink underline (`::after` scaleX) or ink fill — pick **one** idiom to unify the four divergent active-state patterns flagged in the inventory → standardize on **ink-fill + invert-on-hover** for buttons and **scaleX ink underline** for tabs/nav.

### 5.8 Modals / overlays

- `.auth-overlay`, SettingsDrawer backdrop, `.gwelcome`, `.studio-pop`: backdrop = `rgba(0,0,0,.5)` (paper) / `rgba(255,255,255,.4)` (inverted) — **remove `backdrop-filter:blur`**, replace with optional faint grain. reframed doesn't blur; it cuts.
- Modal card: opaque `var(--bg)`, `1px solid var(--line-hard)`, square, no shadow. Entry = `scale(.985)→1` + opacity over `--t-snap` (snappier than current `.35s`).
- SettingsDrawer slides from right (keep), now a hard-edged white/black panel with a full-height left hairline rule.
- `.gwelcome` already black/white — keep, it's the reference.

### 5.9 Cards / surfaces / nav glass

- `.card`: **remove `backdrop-filter:blur(8px)`** and `--shadow-card`. Flat `var(--panel)` + `1px solid var(--line)`. Hover (when interactive): invert-on-hover or a `1px → --ink-max` border darken, no `translateY` lift (drop the `-6px` story-card float → replace with border-darken + grain, or a subtle `2px` lift max).
- `.nav` / `.topbar`: remove the 12px blur glass; make it a clean `var(--bg)` bar with a `--rule-style` bottom hairline (or fully transparent on Gate). Logo `WYRM` in display, the `.w` no longer accent-colored — pure ink; if you want one differentiator, make `W` weight 700 vs rest 400.

---

## 6. CSS MIGRATION MAP

### 6.1 `:root` / token replacements (styles.css lines 767–839, 1168)

| Old var/value | Action | New |
|---|---|---|
| `--display: 'Onest'…` | replace | `'Space Grotesk', 'Archivo', 'Helvetica Neue', Arial, sans-serif` |
| `--serif: 'Lora'…` | repoint | `var(--ui)` (alias; serif retired) |
| `--mono: 'JetBrains Mono'…` | replace | `'SFMono-Regular','JetBrains Mono',ui-monospace,Menlo,monospace` |
| *(new)* | add | `--ui: 'Helvetica Neue',Helvetica,Arial,'Inter',sans-serif` |
| `--accent: var(--accent-default)` | keep alias, repoint | resolves to `var(--ink-max)` per theme |
| `--gold: var(--gold-default)` | keep alias, repoint | resolves to `var(--ink-max)` |
| `--r-card: 14px` / `--r-btn: 10px` | replace | `0px` / `0px`; add `--r-pill:0; --r-input:0` |
| *(new)* | add | full `--sp-*` scale, `--ms-color`, `--ease-snap`, `--t-snap`, `--ease-color`, `--invert-amt`, `--rule-hard`, `--line-hard`, `--ink-max`, all `--fs-*` |

### 6.2 Theme blocks (lines 785–809 Night, 815–839 Manuscript)

- **Delete** both `[data-theme="night"]` and `[data-theme="manuscript"]` token bodies and their behavioral riders (`[data-theme="night"] body::after` vignette line 1306; `[data-theme="manuscript"] .card.framed` double-rule lines 920–923).
- **Replace** with `[data-theme="paper"]` (= new `:root`) and `[data-theme="inverted"]` blocks from §1.2–1.3.
- The `.card.framed` double-rule moves into the base (theme-independent) as a pure-ink Swiss frame.
- `--node-glow` / `--canon-glow` / `--hero-veil` / `--shadow-card` → `none` everywhere; the selectors consuming them (StoryTree, hero veil on `.atmos`) degrade to flat/hairline automatically.

### 6.3 Selectors to rewrite (the two appended override layers win the cascade — edit the *later* declaration)

| Selector(s) | Change |
|---|---|
| `.card` (line 1171) | remove blur + shadow, `--r-card:0`, hairline border, invert/border-darken hover |
| `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-sm` | square, hairline/ink-fill, invert-on-hover, `--ms-color` color transition |
| `.tag` (radius 999px line 1174), `.tag-btn`, `.dot` | square, dot→6px ink square, ink-fill active |
| `.nav` (line 1202), `.topbar` (1504), `.brand .logo .w` (935) | de-glass, hairline bottom rule, `.w` → ink (not accent) |
| `.nav-link::after`, `.plug-tab[data-active]`, `.swatch-tile[data-active]`, `.studio-item[data-active]` | unify to scaleX ink underline (tabs/nav) / ink-fill (buttons) |
| `.story-card` (`.55s` lift), `.feature-cell` | drop translateY lift + deep shadow → border-darken/invert |
| `.tnode`, `.fork-mini`, `.path-crumb`, tree edges | ink-weight canon (§5.6), square, no glow |
| `.toggle`/`.toggle-knob`, `.range` + thumbs | ink fill, square thumb, no color |
| `.caret`, `.live-badge > span` | caret blink kept; live dot → blinking ink square (drop colored `pulse`) |
| `.auth-overlay`, `.mobile-menu`, `.desk-bar`, `.plug-hud`/`.plug-chip` (all `backdrop-filter:blur`) | remove blur; opaque + hairline |
| `.rich-edit/.rich-read blockquote` (`2px solid var(--accent)`) | `2px solid var(--ink-max)` |
| `::selection` (declared twice, 869 & 1195) | `background:var(--ink-max); color:var(--accent-ink)` — collapse to one declaration |
| `.atmos::after`, `.gate-grain` | keep; add `noise` animation, ensure on every route |
| Cinematic intro block (lines 1204+) | already removed per recent commits; ensure no Onest/Lora/gold refs linger |
| Scrollbars (1114–1116, 1196–1199) | thumb → `var(--line-hard)`, track transparent, square |

### 6.4 New utility classes to add

```
.invert-hover (+::after)      /* §4.2 — apply to all interactive surfaces */
.blink, @keyframes blink      /* §4.4 */
@keyframes noise              /* §4.3 */
.navctl, .navctl-back, .navctl-crumb   /* §5.2 global back control */
.route-flash (+ keyframe)     /* §4.5 optional */
.rule, .rule-hard             /* hairline divider helpers */
```

### 6.5 JS touch-points (src/app.jsx — not CSS, but required for the system to land)

- **`ACCENTS` array (L3811–3817): delete.** Remove the "Акцентный цвет" Field (SettingsDrawer item 2).
- **`FONTS` array (L3818–3822):** replace with display options that all stay in-language — e.g. `['grotesk','Space Grotesk',...], ['archivo','Archivo',...], ['mono','JetBrains',...]` — or remove the picker entirely (monochrome system implies one display face).
- **Theme tiles (SettingsDrawer item 1):** `night/manuscript` → `paper/inverted`.
- **Config-apply effect (L3862–3871):** stop writing `--accent`/`--gold` overrides; keep `--display` font swap and `font-size` scale; write `data-theme="paper|inverted"`.
- **Add `routeStack`** to App + a back handler powering `.navctl-back` (§5.2), filling the no-history gap.
- **`Avatar`, `Tag`, `CoverSlot`, `StatusPill`, `CanonMeter`** carry heavy inline `oklch()`/hue styles — these must be edited in JSX (CSS-only won't reach them). Convert inline hue math to the neutral values above.

---

### Summary of the load-bearing decisions for the user to confirm

1. **Color is dropped**, not just retoned — 5 ACCENTS gone, gold/jade/oxblood gone, canon shown by weight not hue. (`--accent`/`--gold` kept as ink aliases for code compatibility.)
2. **Genre hue:** recommend grayscale (Option A); Option B keeps a single colored genre pip as the lone spot of color.
3. **Display face:** Space Grotesk (free OFL) substitutes for proprietary Unhuman; PP Neue Montreal / Söhne if licensing budget exists.
4. **Serif retired** from the core; optional Reader-only opt-in.
5. **Square everything** (radius 0), hairlines + invert-on-hover replace blur + glow + colored shadow.
6. A **global back control** is added, fixing the documented no-history gap.

Files referenced: `/Users/bubble3/Desktop/WYRM - книга/src/styles.css` (tokens/selectors §6.1–6.4), `/Users/bubble3/Desktop/WYRM - книга/src/app.jsx` (JS touch-points §6.5).

---


<a id="2"></a>

# Раздел 2. Бэкенд-сёрфейсинг и логика пользователя

# WYRM — Backend-Surfacing & User-Logic Plan

> Goal: raise **everything** the backend can do into the reframed (monochrome / terminal-lab / Swiss-typographic) UI, evenly across every screen — and redraw every user-logic flow for the new design. Aesthetic anchor: stark `#fff`/`#262626`/`#000`, Helvetica labels in tiny uppercase, giant fluid display face, hairline rules, film grain, blinking terminal cursors, invert-on-hover, motion that respects `prefers-reduced-motion`.

Two structural facts drive the whole plan:

1. **No history/back stack exists** (`route` is a single string; reload → `landing`). Almost every "back" flow below assumes a new shared affordance. The plan introduces a **breadcrumb/back rail** and **History API** as prerequisites — without them, half of the latent backend has nowhere coherent to live.
2. **Eight backend systems are fully built server-side with zero or near-zero UI** (`merge_requests`, `reader_cuts`, `post.media`, `coAppearEdges`, cross-device workspace sync, `room_turn` notifications, i18n, the stake/reputation economy). Surfacing these is where most of the "raise everything" value is.

---

## PART 1 — Backend Capability → UI Surfacing Matrix

Legend for exposure: **Y** = surfaced today · **P** = partial/latent · **N** = no UI.

### Auth & identity

| Capability (store.js / PB) | Today | Where it should surface (redesigned) | New UI element needed |
|---|---|---|---|
| `signUp` / `signIn` (email+pw) | Y | `AuthModal` | Reframed terminal-login: monospace field labels, blinking caret, invert-on-submit. Keep. |
| `signInOAuth` (VK/Yandex/Google/Apple) | P | `AuthModal` OAuth row | Confirm all 4 wired; render as 4 equal hairline-bordered tiles, uppercase labels, invert-on-hover. Disable + tooltip "только на сервере" when `!store.enabled`. |
| `requestPasswordReset` | P | `AuthModal` (login mode) → new sub-state | "Забыли пароль?" expands an inline email row → success/err line in mono red/ink. Gated by `store.enabled`; if demo, show "доступно на сервере". |
| `requestVerification` | P | **New**: post-register banner + Profile header | Thin top "verify your email" hairline strip with `Отправить снова`; Profile shows `● не подтверждён` pill. |
| `signOut` | Y | Burger menu / `AccountMenu` | Keep. |
| `currentUser` / role / reputation | Y/P | Profile header | Reputation gets a **first-class stat** (see Economy). Moderator → `[MOD]` mono tag. |

### Feed / posts / social actions

| Capability | Today | Where | New UI element |
|---|---|---|---|
| `listPosts` + pagination | Y | `Feed`, `CommunityDetail`, `Profile` | Keep; restyle "ещё" as a terminal `LOAD MORE ▸` hairline button. |
| Filters `kind` / `community` / `authorHandle` / `authors[]` | P | `Feed` tab row | Expose **all** kinds as tabs: `ВСЁ · ПОДПИСКИ · ВЕТВИ · ГОЛОСА · СПОРЫ · ЗАПИСИ`. Tabs as tiny uppercase Helvetica with animated underline. |
| `addPost` (4 kinds) | P | `FeedComposer` | Kind selector is already 4 buttons — make the **composer adapt per kind**: `branch`/`vote` show a story-ref picker; `discuss`/`post` plain. |
| `toggleReact('like')` (flame) | Y | `PostCard` action bar | Keep; flame → monochrome glyph, count in mono. |
| `toggleReact('save')` (bookmark) | P | `PostCard` + **new Bookmarks view** | Star/save exists but **saved posts aren't queryable** (no `listBookmarks`). Add a **Profile → "Закладки" tab** that filters client-side OR add `listBookmarks()` to store (see Gaps). |
| `repost` | Y | `PostCard` | Keep (one-shot). |
| `listComments` / `addComment` | Y | `PostCard` expand | Keep; comment field as inline terminal row. |
| `deletePost` (mod/author) | P | `PostCard` | Surface delete consistently; moderator-delete gets `[MOD]` confirm copy. |
| `toggleFollow` / `listFollowing` | P | `PostCard` header + **Profile** | Follow pill in header (have). Add Profile "Подписки/Читатели" counts; `ПОДПИСКИ` feed tab depends on this. |

### Communities

| Capability | Today | Where | New UI |
|---|---|---|---|
| `listCommunities` / `joined` | Y | `Communities`, `Social` | Keep. |
| `createCommunity` | Y | `CommunityCreate` | Keep; restyle preview banner monochrome (gradient → grain + inverted name). |
| `toggleJoin` | Y | `CommunityCard`, `CommunityDetail` | Keep (optimistic). |
| `deleteCommunity` (owner/mod) | P | `CommunityDetail` | Keep; gate behind `canManage`. |

### Stories / tree / canon

| Capability | Today | Where | New UI |
|---|---|---|---|
| `listStories` / `getStory` | Y | `Catalog`, `Reader` | Keep. |
| `createStory` (+cover upload) | Y | `Compose` newbook | Keep; cover upload as drag-zone with grain placeholder. |
| `listNodes` / `addNode` | Y | `Reader`, `StoryTree` | Keep. |
| `voteNode` | Y | Reader / `ReadingColumn` | Keep; "За канон" → invert-on-hover. |
| `stakeNode` (weighted) | P | `Stakes` screen | **Under-surfaced.** Promote: reputation budget visible in header + a stake CTA reachable from any fork in Reader (see Economy flow). |
| `canonPath` / `markCanon` | Y | tree + reader | Keep; canon line = the **one** place a single hairline-gold accent is allowed, else monochrome. |
| Reputation economy (±5 canon, stake budget) | P | Profile / Stakes / Reader | New **reputation HUD** (mono, top-right of relevant screens): `REP 240`. |

### Studio mechanics (latent-heavy)

| Capability | Today | Where | New UI |
|---|---|---|---|
| `diff.diffSentences` / `applyMerge` | P (client-only) | `Merge` screen | Keep client diff, but **persist** as `merge_requests` (see Gaps). |
| **`merge_requests` collection** | **N** | `Merge` + **new "Запросы слияния" inbox** | Full PR-inbox: list of open MRs per story, status pills (`OPEN/APPROVED/MERGED/REJECTED`), approval roster. This is the biggest latent system. |
| `consistency.*` (LoreGraph) | P | `LoreGraph` | Keep; render graph monochrome with hairline edges. |
| `coAppearEdges` (relationship graph) | P (computed, unrendered) | `LoreGraph` second view | **New** "Связи" toggle: co-appearance graph, edge weight = stroke width. |
| `appearancesOf` / `latestStatuses` | P | LoreGraph codex rail | Surface character timeline as a vertical hairline ledger. |
| **`reader_cuts` collection** | **N** | `ReadersCut` screen | Persist cuts: "Сохранить версию" → `store.saveCut` (new). List "Мои версии" in Profile. |
| Realtime room (relay) | Y (demo) | `WritersRoom` | Keep; presence redesign (Part 4). |
| Direction proposals / votes / reacts | P | `WritersRoom` | Keep; surface vote bars as terminal meters. |

### Workspace / writer desk

| Capability | Today | Where | New UI |
|---|---|---|---|
| `getWorkspaceCfg` / `saveWorkspaceCfg` | Y | `Compose` desk | Keep. |
| `listWorkspacePresets` / `saveWorkspacePreset` | P | desk preset `<select>` | Promote to a small **preset manager** (rename/delete) in desk bar. |
| **Cross-device sync (`__active__`)** | **N (invisible)** | desk bar | Add a tiny `☁ синхронизировано` mono indicator when `store.enabled`. |

### Notifications / media / i18n

| Capability | Today | Where | New UI |
|---|---|---|---|
| `listNotifications` / `markAllRead` | Y | `NotificationsMenu` | Keep; restyle as terminal log lines (`[12:04] @x ▸ канон`). |
| `room_turn` notification kind | **N (never produced)** | — | Needs a **server producer** + client handling (see Gaps); on client, route to `WritersRoom`. |
| **`post.media` (image attach)** | **N (never sent)** | `FeedComposer` | Add image attach button → `store.addPost({media})`; render in `PostCard` as bordered monochrome thumb. |
| **i18n (`t()`, RU-only dict)** | **N** | Settings + new lang switch | Add `RU / EN` switch in Settings; wire `t()` through labels incrementally. |

---

## PART 2 — User-Logic Flows (redrawn for the new design)

**Shared prerequisites introduced by this plan** (referenced throughout):
- **History API**: `go()` calls `history.pushState`; a `popstate` handler restores `route`+`ctx`. Reload no longer dumps to `landing`.
- **Back/breadcrumb rail**: a persistent hairline strip under the topbar on every non-landing screen: `‹ НАЗАД` (mono, invert-on-hover) + breadcrumb `КАТАЛОГ › ПЕПЕЛ АРКАДИИ › ГЛ. A1`.
- **`ctx` reset**: `go()` clears stale story/node keys when crossing story boundaries (current accumulation bug).
- **Universal state pattern** (terminal-lab): **loading** = blinking caret + mono `// загрузка…`; **empty** = hairline box + mono dim line; **error** = mono `! <message>` in near-black on a 1px ruled row, never a colored toast.

### Flow A — Auth (oauth / email / login / register / logout / reset / verify)

- **Entry points:** Gate corner `ПРОФИЛЬ`; any "Войти" CTA in `FeedComposer`/`CommunityCreate`/`PostCard`; burger "Войти".
- **Steps (login/register):**
  1. `openAuth(mode)` → `AuthModal` opens (focus-trapped, Esc closes, restores focus).
  2. Terminal form: mono field labels, blinking caret in focused field. `valid` gates the submit; submit shows `// минуту…`.
  3. Success → `onAuth(u)` persists `wyrm.user`, modal closes, the triggering action resumes (e.g. the half-typed post).
- **OAuth:** 4 tiles → `social(prov)`. Demo (`!store.enabled`) → instant guest; server → `signInOAuth` redirect. Disabled tiles carry a mono `// сервер` hint.
- **Reset:** login mode → "Забыли пароль?" reveals an inline email row → `requestPasswordReset` → confirmation line. Demo → `// доступно на сервере`.
- **Verify (new):** after register, a hairline strip persists app-wide until verified; `Отправить снова` → `requestVerification`.
- **Logout:** burger/`AccountMenu` "Выйти" → `signOut()` + clear user → returns to current public screen (not forced to landing).
- **Nav:** modal is an overlay — back = close, returns to origin route.
- **States:** loading = submit caret; empty = n/a; error = mono red line under the form (existing `err`).

### Flow B — Posting to feed

- **Entry:** `FeedComposer` atop `Feed`, inside `CommunityDetail` (defaultKind `discuss`), Profile.
- **Steps:** pick kind (4 mono tabs) → type in terminal `<textarea>` → optional genres (max 3) → optional **image attach (new)** → `Опубликовать`.
  - If `branch`/`vote` kind: a **story-ref picker** appears (select story → optional node) writing `ref`.
- **Submit:** `onPost(...)` → optimistic prepend **iff** it matches the active filter (`matchesFilter`); else it's posted but not shown in this tab (mono toast-line `// опубликовано в ВЕТВИ`).
- **Logged-out:** composer collapses to prompt + "Войти и писать" → Flow A, then resumes.
- **Nav:** none (inline). **Loading:** button caret. **Error:** rollback + mono `! не удалось`.

### Flow C — React / repost / comment / bookmark

- **Entry:** `PostCard` action bar (unified model).
- **Like:** flame toggle, optimistic `±1`, rollback on error.
- **Repost:** one-shot; disabled if logged-out/already; `repost_count` updates; produces a server notification to author.
- **Comment:** expand → lazy `listComments` (blinking caret while loading) → terminal reply row (Enter submits) → `addComment` appends, `comment_count+1`.
- **Bookmark:** star toggle (`save`). **New:** saved posts become reviewable in **Profile → Закладки**.
- **Nav:** all inline. **Empty comments:** mono `// тишина`. **Logged-out:** action bar visible but actions route to Flow A.

### Flow D — Following

- **Entry:** `PostCard` header follow-pill (feed only today → also add to Profile headers and author crumbs).
- **Steps:** `onFollow(handle)` → `toggleFollow` → updates `following[]` (optimistic). Pill flips `+ подписаться` ↔ `✓ читаю`.
- **Payoff:** `ПОДПИСКИ` feed tab = `listPosts({authors: following})`; empty following → mono `// ты ещё ни на кого не подписан → найти авторов`.
- **Nav/states:** inline; optimistic with rollback.

### Flow E — Join / create community

- **Join:** `CommunityCard`/`CommunityDetail` button → `toggleJoin` (optimistic, member count `±1`).
- **Create:** `Communities` → "Создать" → `CommunityCreate` (live monochrome preview) → `Основать` → `createCommunity` → **forward-nav** to the new `community` page.
- **Delete (owner/mod):** `CommunityDetail` → confirm → `deleteCommunity` → back to `communities`.
- **Nav:** create/detail use the new breadcrumb (`СООБЩЕСТВА › <name>`). **Loading:** card skeletons = hairline boxes. **Empty grid:** mono `// сообществ пока нет`.

### Flow F — Writing a branch (fork) / new book

- **Entry:** Reader "А что, если…" / continuation CTA / Gate `ВЕРСТАК` / Compose.
- **Fork steps:** `go('compose',{forkFrom, story})` → writer's desk (docks: navigator/properties/notes/focus). Parent-context card shows where you branch from. Write title + `RichEditor` body (+ `.docx`/`.txt` import). Optional character-fate edits (parallel line). Word-goal meter. → `Опубликовать` → `addNode` → **Done** screen → `К древу` (`go('reader',{story,node})`).
- **New book:** ModeToggle → title/synopsis/genre-wheel/cover/community → `publishBook` → `createStory` → Done.
- **Nav:** desk "К древу" + new breadcrumb. Autosave to `wyrm.draft` (mono `// черновик сохранён HH:MM`). **Error:** `wyrmErr` → mono line, draft preserved.

### Flow G — Voting / canon

- **Entry:** Reader node-detail, `ReadingColumn`, tree nodes.
- **Steps:** `За канон` → `voteNode` (toggle). Server hook recomputes canon path, adjusts author reputation ±5, may flip `canon`, emits `canon` notification.
- **Visual:** canon line is the sole gold-hairline accent; `CanonMeter` animates width. Voted state = inverted button + `✓ голос учтён`.
- **Stake (promoted):** at any contested fork, `Усилить голос` → `Stakes` with that fork preloaded; spend reputation budget; `stakeNode(weight)`. Self-vote rejected by server → mono `! нельзя голосовать за свою ветку`.
- **Nav:** inline / forward to Stakes. **Loading:** meter caret. **Error:** rollback.

### Flow H — Realtime presence / live updates (WritersRoom)

- **Entry:** `go('room')` / `КОМНАТА` nav / (new) `room_turn` notification.
- **Connect:** `connectRoom` → real WS if `token`, else demo sim. While `!st` → centered `// подключение к комнате…` with blinking caret.
- **Live loop:** turn holder + countdown; if I hold the pen → terminal `<textarea>` with live caret, others see my `buffer` stream char-by-char with a `.caret`. `Передать перо` → `commit`. Reactions (flame/star), direction proposals + voting (terminal meters), relay queue (join/leave).
- **Nav:** breadcrumb back; cleanup closes WS + clears tick on unmount.
- **States:** live badge `● В ЭФИРЕ` (pulsing) vs `демо-режим` (static dim); disconnect → `// переподключение…` (exp backoff); auth fail (4001) → `! сессия истекла`.

### Flow I — Notifications

- **Entry:** header bell (only when logged in).
- **Steps:** `listNotifications` → terminal log lines with kind glyph + `timeAgo`. Unread = leading `●` + count badge. `прочитать всё` → `markAllNotificationsRead` + reload.
- **New:** clicking a line **navigates to source** (currently display-only): `canon`→reader node, `comment`/`like`/`repost`→post, `room_turn`→room.
- **States:** empty = `// пусто`; loading = caret.

---

## PART 3 — Gaps: latent backend with NO UI today (+ proposed UI)

| # | Latent system | Proposed UI surface | Store work needed |
|---|---|---|---|
| 1 | **`merge_requests`** (status/hunks/approvals, owner-mod rules) — full server workflow, no client reads it | **New "Запросы слияния" inbox** per story (reachable from Reader header + Merge screen). List MRs with status pills, approval roster, "открыть в Merge". `Merge` publishes its result **as an MR** instead of (or before) writing a node. | Add `listMergeRequests(story)`, `createMergeRequest`, `approveMergeRequest`, `mergeMergeRequest`. |
| 2 | **`reader_cuts`** (saved paths) — schema only, no CRUD | `ReadersCut` gains `Сохранить версию`; **Profile → "Мои версии" tab** lists saved cuts (open / share `#cut=` / download). | Add `saveCut(story,path,title)`, `listCuts()`, `deleteCut(id)`. |
| 3 | **`post.media`** (10MB file field, never written) | Image-attach button in `FeedComposer`; `PostCard` renders bordered monochrome (grayscale + grain) thumb, click → lightbox. | `addPost` send `media`; `listPosts` hydrate URLs. |
| 4 | **`coAppearEdges`** (relationship graph, computed, unrendered) | `LoreGraph` second tab "Связи": co-appearance graph, edge stroke = weight, hairline monochrome. | None (data already computed). |
| 5 | **Cross-device workspace sync** (`__active__`, invisible) | Tiny `☁ синхронизировано · HH:MM` mono indicator in desk bar; on load, offer "восстановить раскладку с другого устройства". | Surface `loadWorkspaceCfgRemote` on desk mount. |
| 6 | **`room_turn` notification** (enum defined, never produced) | Once produced, notification line `@you ▸ твой ход в комнате` → deep-links to `WritersRoom`. | **Server**: emit `room_turn` when pen passes to a user who's away. Client: route on click. |
| 7 | **i18n** (`t()` plumbing, RU-only dict, no switcher) | `RU / EN` segmented switch in Settings ("Язык"); persist `VITE_LANG`/localStorage; migrate labels to `t()` incrementally. | Fill `en` dictionary; thread `t()` through components. |
| 8 | **Stake / reputation economy** (weighted voting end-to-end, under-surfaced) | Reputation HUD (`REP 240`) on Profile/Reader/Stakes; `Усилить голос` CTA at contested forks; ledger of where rep came from (canon wins). | None server-side; surface existing `stakeNode`/reputation. |
| 9 | **Saved/bookmarked posts not queryable** (`save` writes count, no list) | Profile → "Закладки" tab. | Add `listBookmarks()` (or filter `likes` join by `kind='save'` for current user). |
| 10 | **Email verification UI** | App-wide hairline "подтверди почту" strip + Profile `● не подтверждён` pill + resend. | Surface `requestVerification`; read verified flag from user record. |

---

## PART 4 — Realtime presence in the reframed (terminal/lab) aesthetic

The reframed look is **terminal lab** — blinking cursors, film grain, monochrome, invert-on-hover, hairline rules. Realtime should read like a **live console log**, not chat bubbles.

**Presence & live activity manifest as:**

1. **The blinking caret is the presence primitive.** A `.caret` (`@keyframes blink`, .25s steps) sits wherever someone is actively writing — at the end of the live `buffer` in WritersRoom, and (new) as a tiny caret next to an author's name in the relay queue when they hold the pen. Reduced-motion → caret becomes a static solid block.

2. **Live status as a console badge, not a colored dot.** `● В ЭФИРЕ` in mono uppercase with a single pulsing glyph (`@keyframes pulse`, opacity 1→.35) — the **only** animated colorless "live" signal. Demo mode = identical layout, static dim glyph + `демо-режим`. No green/red; "alive" reads through motion + weight, per the monochrome palette.

3. **Streaming text = typewriter, char-by-char.** The other writer's `buffer` renders incrementally into a `.serif rich-read` block with a trailing caret — literally watching prose appear. Grain overlay (`.atmos::after`) stays on top so it reads as "lab feed."

4. **The relay queue = a terminal roster.** Mono lines: `▸ @holder    пишет · 0:42` / `· @next     следующий` / `· @x        в очереди`. The active line gets **invert-on-hover** (`backdrop-filter:invert(100%)`) — the reframed signature — so hovering "selects" a writer.

5. **Reactions & direction votes = ASCII meters.** `flame`/`star` reacts shown as `уголёк ▮▮▮ 12`. Direction voting bars rendered as hairline tracks that fill in near-black; leader line bolds (700) rather than colors. `pct%` in mono.

6. **Notifications = a live log tail.** The bell dropdown is a monospace log: `[12:04] @mara ▸ канон  ●` (unread `●`). New items push in from the top with a 125ms color transition (the reframed hover-speed), no slide animations beyond reduced-motion limits.

7. **Connection lifecycle is spoken in the terminal voice.** `// подключение к комнате…` → `● В ЭФИРЕ` → on drop `// переподключение… (попытка 2)` → on 4001 `! сессия истекла — войти заново`. All mono, left-ruled, never modal toasts.

8. **Optional global "pulse" ticker (new, low-cost).** A one-line hairline ticker under the topbar on Feed showing server activity as it lands: `+ @nyx ветвь «Сделка с тенью» · 2с` — driven by the same optimistic-insert events `useFeed` already produces. Reframed: tiny uppercase, invert-on-hover to pause/expand. This turns the otherwise-static feed into a visibly *live* lab without new backend.

---

### Sequencing note (so the plan is buildable)

1. **Foundation first:** History API + breadcrumb/back rail + `ctx` reset + universal loading/empty/error terminal states. Everything else leans on these.
2. **Zero-backend wins:** `coAppearEdges` graph (#4), reputation HUD (#8), notification deep-links (Flow I), live ticker (#4 in Part 4), workspace sync indicator (#5). Pure surfacing, no store changes.
3. **Small store additions:** `listBookmarks` (#9), `reader_cuts` CRUD (#2), `post.media` send (#3), verification surfacing (#10).
4. **Larger systems:** `merge_requests` workflow (#1) and the `room_turn` server producer (#6) — net-new client+server work, highest latent value.

Files this plan touches: `/Users/bubble3/Desktop/WYRM - книга/src/app.jsx` (all screens/components), `/Users/bubble3/Desktop/WYRM - книга/src/styles.css` (terminal-lab tokens, caret/pulse/invert, breadcrumb rail), `/Users/bubble3/Desktop/WYRM - книга/src/lib/store.js` (merge_requests, reader_cuts, listBookmarks, media), `/Users/bubble3/Desktop/WYRM - книга/src/lib/realtime.js` + `/Users/bubble3/Desktop/WYRM - книга/realtime/server.js` (room_turn producer), `/Users/bubble3/Desktop/WYRM - книга/src/lib/i18n.js` (en dict + switcher).

---


<a id="3"></a>

# Раздел 3. Экраны — Story Core (Gate / Catalog / Tree / Reader / Compose)

# WYRM → reframed.online — STORY CORE Redesign Plan

**Scope:** Gate/Landing · Catalog · StoryTree screen (древо) · Reader · Compose.
**System reference:** all tokens, faces, motion curves, and the global back control are defined in the canonical design-system spec (§0–§6). This document applies that system element-by-element. Token shorthand used below: `--ink`/`--ink-2`/`--ink-3`/`--ink-max`, `--bg`/`--bg-2`/`--bg-3`, `--line`/`--line-soft`/`--line-hard`, `--accent-ink` (text-on-fill), `--ms-color` (125ms color hover), `--t-snap` (.2s snappy), `--ease` (page-in). "Invert-on-hover" = the `.invert-hover::after backdrop-filter:invert()` primitive (§4.2). All radii → 0. No glow, no blur, no chromatic color (genre hue → Option A grayscale).

> **Global to all five screens:** the new fixed top-left `.navctl` cluster (§5.2) — `[ ← НАЗАД ] · WYRM / <route label>` — appears on every screen here except the Gate. It is powered by the new `routeStack`. This replaces the ad-hoc per-screen crumbs documented in the inventory (Reader has none, Compose's "К древу", Studio's "← древо"). Per-screen back affordances below describe how each existing exit folds into this control. The burger stays top-right.

---

## SCREEN 1 — GATE (`route==='landing'`, app.jsx L770–882)

The Gate already half-speaks the target language; here we align it fully and add motion. It keeps its self-contained `--g-*` palette (align `--g-bg → #ffffff`, `--g-ink → #262626`; warm off-white is an acceptable Gate-only signature if preferred). **No `.navctl` on the Gate** — it is the root, full-bleed, no chrome.

| Element | BEFORE | AFTER |
|---|---|---|
| **`.gate` root** | Fixed full-screen, no scroll, own light palette, pointer-parallax `--gx/--gy` (±14px, eased .06). | Keep fixed/no-scroll/parallax. Background pure `#fff` (or warm off-white). Add the animated film-grain `noise` (§4.3) to `.gate-grain` so the Gate breathes like the rest of the app. `color-scheme:light`. |
| **`.gate-grain`** | Static SVG turbulence, opacity .045, overlay. | Keep; apply `animation: noise .5s steps(4) infinite`, `mix-blend-mode:overlay`, opacity `var(--grain-opacity)`. Frozen under reduced-motion. |
| **`.gate-circle` (+`::after`), `.gate-centerline`, `GateRegMark ×2`** | Hairline guide geometry; circle "breathes" (18/22s), reg-marks spin (34s). | Keep as hairline `--g-line` lab geometry — this IS the reframed "Digital inspiration Lab" vibe. Lines stay hairline; ensure 1px crispness. Breathe/spin retained but killed under reduced-motion (already are). |
| **`.gate-eyebrow`** "СОТВОРИ ИСТОРИЮ ВМЕСТЕ" | Mono uppercase eyebrow, centered above wordmark. | `.mono` 500, `--fs-meta` (12px), `letter-spacing:+0.2em`, UPPERCASE, `--g-ink` at `--ink-3` weight. **Append a blinking block cursor** `<span class="blink">▋</span>` (§4.4) — terminal-lab accent. |
| **`.gate-word` (WYRM CTA)** | Three stacked spans `WY`/`RM`/mirrored `RM`; blurred `blur(8px)→blur(1px)` on hover/focus; widened `scaleX(1.14)`; float ±7px. | Becomes **Space Grotesk** display, weight 400, `letter-spacing:-0.0208em`, `line-height:.8`, `--fs-d1` clamp(64px,8.28vw,159px) — already huge per inventory (`clamp(6rem,30vw,24rem)`); retune to the d1 curve. **Keep the blur→sharp focus reveal** (it is on-language and the Gate's signature). Mirror line stays `scaleY(-1)` decorative reflection. Float retained, killed under reduced-motion. |
| **`.gate-word-mirror`** | Static flipped reflection beneath. | Unchanged structurally; now in grotesque. `aria-hidden` kept. |

**UI/UX controls — four corner nav (`GateCorner`):**

| Corner | BEFORE | AFTER | Hover / Active / Focus |
|---|---|---|---|
| `tl` КАТАЛОГ · древо историй → `go('catalog')` | Button, label + sub, hairline underline `::after`. | Square hairline corner button, `.mono` UPPERCASE label `--fs-ui-sm`, sub in `--fs-meta`/`--ink-3`. Add `.invert-hover`. | Hover/focus-visible → invert-on-hover (background→ink, text→paper) over `--ms-color`. Underline `::after` retained as secondary tell. Focus ring = 2px ink outline offset 2px. |
| `tr` ЛЕНТА · сообщество → `go('feed')` | Same. | Same treatment; arrow absent (no `arrow` prop) — keep. | Same. |
| `bl` ПРОФИЛЬ · настройки · плагины → `go('profile')` (arrow) | Same + 9×9 arrow-out SVG. | Same; arrow stroke 1.25 (§5.3). | Same; arrow inherits invert. |
| `br` ВЕРСТАК · студия → `go('compose')` (arrow) | Same. | Same. | Same. |

**`.gate-word` CTA →** `setWelcome(true)`: unchanged behavior. Hover = blur→sharp (kept). Focus-visible = 2px ink outline.

**Welcome overlay (`.gwelcome`, dialog):** already black/white — the reference for the whole system. Keep verbatim.
- `.gwelcome-greeting` with `<strong>ПОЛЬЗОВАТЕЛЬ</strong>`/`<strong>WYRM</strong>` — display grotesque, weight 400 body / 700 on the `<strong>` words.
- `.gwelcome-actions` two `.gwelcome-btn`: **"ВОЙТИ В WYRM"** → `go('home')` is the inked primary (`background:#000; color:#fff`, invert-to-outline on hover); **"ОСМОТРЕТЬСЯ"** → `setWelcome(false)` is the hairline secondary (transparent, 1px ink border, invert-on-hover). Square, `--fs-ui` mono-ish, no radius.
- Entry: `fade .28s` → retune to `scale(.985)→1 + opacity` over `--t-snap`.

**Empty/loading/error:** Gate has no data — none. **A11y:** keep the existing dialog focus-trap, Escape-closes, focus-returns-to-wordmark effect (L804–826) verbatim — it is correct. Parallax/float/spin/breathe all already gated behind `prefers-reduced-motion`. The animated grain must also freeze under reduce (§4.6).

---

## SCREEN 2 — LANDING (`route==='home'`, app.jsx L549–635)

`.navctl` present (label "WYRM / Главная"; `← НАЗАД` pops to Gate when stack empty → label `← ВОРОТА`). `.view` gets the `viewIn` route-in animation (`translateY(8px)→0`, .32s `--ease`). All `.reveal` scroll-reveals kept (opacity-stable, transform-only). Heavy inline styles here must be edited in JSX (CSS-only won't reach them).

### HERO (L561–573)
- **BEFORE:** `h1.display clamp(3.4rem,12vw,11rem)`, accent-colored word «сообщество»; serif-italic lede; two buttons.
- **AFTER:** `h1` → Space Grotesk 400, `--fs-d1` curve, `letter-spacing:-0.0208em`, `line-height:.9`, `text-wrap:balance`. **The accent-colored span «сообщество» loses its color** → pure `--ink-max`; differentiate by weight 700 (vs 400 surrounding) — the one permitted typographic emphasis, no hue. Lede `.serif-italic` → repoints to `--ui` (Helvetica) at `--fs-read`, `--ink-2`, `line-height:1.6` (serif retired §2.5). Vertical rhythm to the `--sp-*` scale.
- **Controls:**
  - `.btn-primary` "Открыть древо" (icon `branch`, stroke 1.25) → `go('reader',{story:'ashes',node:null})`. Inked square; hover = invert-to-outline over `--ms-color`; active = 1px inset shift (no scale); focus-visible = 2px ink outline.
  - `.btn-ghost` "Каталог историй" → `go('catalog')`. Borderless, `--ink-2`; hover → `--ink-max` + underline reveals via `::after scaleX`.

### FLAGSHIP STRIP (`.card.framed`, L577–600)
- **BEFORE:** Framed card, 2-col grid; eyebrow, title, synopsis, 3 stats, primary CTA; right pane = MiniTree across a `--rule-style` border.
- **AFTER:** `.card.framed` → the **Swiss double-frame** (outer hairline + 4px inset second hairline in pure ink, §3.3), `border-radius:0`, `box-shadow:none`, flat `--panel`. Eyebrow `.mono +0.2em` UPPERCASE; title `--fs-d4` grotesque 700; synopsis `--ui`/`--ink-2`. Stat trio (`Соавторов`/`Ветвей`/`Читают канон`): big number `.display --fs-h1`, label `.mono --fs-meta`/`--ink-3`. The center vertical `borderLeft:--rule-style` stays a hairline.
- **Controls:** `.btn-primary` "Читать и ветвить" (icon `arrow`) → reader/ashes — inked, invert-on-hover.

**MiniTree (L638–663):** **BEFORE:** clickable SVG, 7 dots, canon dots `var(--gold)` + halo ring, others `var(--accent)`, gold/line edges, caption "живое древо · нажми". **AFTER:** drop color entirely — **canon dots = filled `--ink-max` squares** (not gold circles) with a 1px `--ink` corner-style marker; non-canon = `--ink-2` open squares; edges canon = `--line-hard` 1px, others = `--line`. Caption `.mono --fs-meta`/`--ink-3`, append `<span class="blink">▋</span>`. Whole button gets invert-on-hover; title attr kept. Focus-visible = ink outline.

### FEATURES (numbered 01–04, L603–619)
- **BEFORE:** 4 `.feature-cell` non-interactive cards on a `--line-soft` grid; index in accent color; icon in `--ink-3`; hover bg.
- **AFTER:** Grid gap = 1px hairlines (`background:var(--line)`), cells flat `--bg`. Index number → `.mono`, **drop accent color → `--ink-max`** weight 700. Icons stroke 1.25, `--ink-3`. Titles `.display --fs-d5`-ish (1.35rem→keep), bodies `--ui`/`--ink-2`. Section header "Как это работает" `--fs-h1` grotesque; "04 механики" `.mono`/`--ink-3` with `--rule-hard` top border on the row. Cells non-interactive → no invert; subtle hover = `--bg-2` fill over `--ms-color` only (decorative, optional).

### CLOSING CTA (L623–632)
- **BEFORE:** flame icon, big h2 `clamp(2.2rem,6vw,4.6rem)`, serif-italic lede, primary "Начать ветку".
- **AFTER:** flame icon stroke 1.25, `--ink-3`. h2 → `--fs-d3` grotesque 400 tight. Lede → Helvetica `--fs-read`/`--ink-2`. `.btn-primary` "Начать ветку" (icon `quill`) → `go('compose')` — inked, invert-on-hover.

**Loading/empty:** Landing reads `window.WYRM.FLAGSHIP` (static) → no loading state. Catalog feeds it; none needed here. **A11y:** `.navctl-back` is a real `<button>`, reachable first in tab order; `viewIn` + `noise` + scroll-reveal all killed under reduced-motion (reveals already opacity-stable). Icon-only flame is decorative — ensure `aria-hidden`.

---

## SCREEN 3 — CATALOG (`route==='catalog'`, app.jsx L666–725)

`.navctl` present (label "WYRM / Каталог"). `.view.wrap`.

### Header — `PageHead index="01"` (L682–683)
- **BEFORE:** `page-head` with index/eyebrow/rule/meta + `h1.page-head-title.display clamp(2.6rem,7.2vw,5.6rem)` + serif-italic lede.
- **AFTER:** index `.mono`/`--ink-3`; eyebrow `.mono +0.2em` UPPERCASE; `page-head-rule` = `--line-hard` hairline; title → Space Grotesk 400, `--fs-d2` curve `clamp(48px,calc(1.5625vw+36px),85px)`, `letter-spacing:-0.0208em`, `line-height:.9`. `page-head-meta` "N работ" `.mono --fs-meta`. Lede `.page-head-lede` repoints serif→`--ui` Helvetica, `--ink-2`, max 48ch.

### Filter / Sort bar (L686–697)
- **BEFORE:** mono "Жанр"; "Все" `.tag.tag-btn` (`data-active`); per-tag `<Tag asButton>` (colored `.dot` circle); two `.nav-link` sort toggles.
- **AFTER:** Row framed top+bottom by `--rule-style` hairlines (kept). "Жанр" `.mono`/`--ink-3`. Tag buttons → **square** (`--r-pill:0`), `1px solid var(--line)`, `.mono` UPPERCASE `--fs-meta`; the colored **`.dot` becomes a 6px solid `--ink` square** (§5.4, Option A). `data-active` → filled: `background:--ink-max; color:--accent-ink; border-color:--ink-max`. `.tag-btn` adds invert-on-hover.
  - **"Все"** filter button: same square hairline; `data-active={!active}` → setActive(null).
  - **Sort `.nav-link` ×2** ("Популярные"/"Ветвистые"): unify to the **scaleX ink underline** idiom (§5.7) — `::after` ink underline grows on active/hover; no fill. Active = full underline + `--ink-max` text.

### Story grid (`.story-card` ×N, L700–724)
- **BEFORE:** `.story-card` buttons, hover `translateY(-6px)` + deep shadow + `h3→accent`; `CoverSlot` with hue radial glow; "В огне" badge on accent bg; title, `WY_NN ©26` code, `@author`, synopsis, tags, footer stats.
- **AFTER:**
  - Card: flat `--panel`, `1px solid var(--line)`, `border-radius:0`, `box-shadow:none`. **Drop the −6px float** → hover = border darken to `--ink-max` + invert-on-hover over `--ms-color` (max 2px lift if any). `h3` hover loses accent → stays `--ink` (border carries the state).
  - **CoverSlot:** drop hue radial glow → grayscale diagonal hatch `repeating-linear-gradient(135deg,var(--bg-2) 0 8px,var(--bg-3) 8px 16px)` + centered `.mono`/`--ink-3` label; square, `1px solid var(--line-soft)`. With `src`: `filter:grayscale(1) contrast(1.05)`; on card hover → `filter:none` (the reframed reveal beat). Must be edited in JSX (inline-styled).
  - **"В огне" badge:** drop accent bg → ink fill `background:--ink-max; color:--accent-ink`, square, `.mono --fs-micro`, icon `flame` stroke 1.25.
  - Title `.display --fs-h2`; **code `WY_NN ©26`** → `.code` mono UPPERCASE `+0.14em`/`--ink-3`; `@author` `.mono --fs-meta`; synopsis `--ui`/`--ink-2`; tags = restyled square Tags; footer stats (users count, "N ветвей") `.mono --fs-meta`/`--ink-3` with icons stroke 1.25.
  - Whole card click → `go('reader',{story:s.id})`.

**States:**
- **Loading:** `store.listStories()` resolves async over the static seed — currently no skeleton. **Add** a grayscale skeleton: cards render with hatch CoverSlot + `--bg-3` placeholder bars (the `--bg-3` "sunken/placeholder stripes" token) animated only by static grain (no shimmer under reduce).
- **Empty (filter yields nothing):** `.mono`/`--ink-3` centered "Ничего в этом жанре." + a hairline "Сбросить фильтр" `.btn-ghost` → setActive(null). (None exists today — add.)
- **Error:** seed fallback already covers fetch failure; surface a `.mono`/`--ink-3` hairline notice "Показаны сохранённые истории" if `store` rejects.

**A11y:** cards are `<button>`s (kept) with `textAlign:left`; ensure each has an accessible name (title or `aria-label` with story title). Sort/filter active state announced via `aria-pressed`. Focus-visible 2px ink outline on every card/tag. Reduced-motion kills viewIn + reveal + grain animation.

---

## SCREEN 4 — STORYTREE SCREEN / ДРЕВО (Reader map-mode + `StoryTree` primitive)

The "древо" is Reader's **map mode**; the interactive graph is the `StoryTree` primitive (canon-by-gold today → canon-by-weight). `.navctl` present (label "WYRM / Древо"). Covered here as its own screen per the task; the reading half is Screen 5-adjacent (Reader, below).

### `StoryTree` primitive (the graph)
- **BEFORE:** `.tree-scroll` pan/zoom box, radial-gradient bg, drag-to-pan; bezier edges (canon=gold thick, hover/selected-path=accent, idle=line); `.tnode` buttons bordered gold(canon)/accent(selected)/line, `--canon-glow`/`--node-glow` shadows, selected lifts `translateY(-2px) scale(1.015)`, dimmed `.26` when filtered.
- **AFTER:**
  - **`.tree-scroll`:** keep pan/zoom and drag (ignore drags starting on `.tnode`); radial-gradient bg → flat `--bg` (or faint `--bg-2` vignette, no color). Height `clamp(440px,62vh,720px)` kept. Add static grain. Cursor grab/grabbing kept.
  - **Edges:** canon = `--line-hard` **2px solid**; hover/selected path = `--ink-max` 2px; idle = `--line` 1px. No color. (Must edit the inline SVG stroke logic in JSX.)
  - **`.tnode`:** square, `1px solid var(--line)`, no glow. **Canon node** = `2px solid var(--ink-max)` + a filled `★` corner marker (§5.6). **Selected** = `2px solid var(--ink-max)` + a 2px inset second rule (Swiss double-frame) — replaces the accent ring; drop the `translateY/scale` lift (or cap at 2px). Dimmed non-matching nodes stay `opacity:.26`.
    - Node contents: `.mono` chapter id "гл · ID"; canon badge (`Icon star` stroke 1.25 + "КАНОН" `.mono`) vs `Icon branch`; `.display` title (grotesque); `<CanonMeter>`; footer = `<Avatar size=20>` (square now) + `.mono` vote count + fork affordance.
    - `onClick`→`onSelect`; `onMouseEnter/Leave` highlight ancestor path (now via `--ink-max` edge weight, not color).
  - **`.fork-mini`** ("Развилка: а что, если…" → `onFork`): square hairline `.mono`, invert-on-hover; `Icon fork` stroke 1.25 + "Ветвь". Stops propagation (kept).

### Map-mode chrome (Reader, map branch)
- **Orientation toggle** "Дерево" (`vertical`) / "Радиально" (`radial`) — segmented `btn btn-sm`: square, hairline; active = ink-fill `--ink-max`/`--accent-ink` (was `--bg-3`); invert-on-hover. `layoutTree` unchanged.
- **Mood filter:** `.mono` "фильтр настроения"; **"Все"** `.tag.tag-btn` (`data-active={!filter}`); one `<Tag asButton>` per tag (square, 6px ink-square dot) → toggles `setFilter`. Filtered nodes dim via opacity (no hue).
- **`reader-grid` (`1fr 366px`):** collapse breakpoint retargeted 940px → **800px** (§3.4); rail width unified to **340px**.
- **Sidebar `<aside>` sticky top:84:**
  - Node-detail `.card.framed` (Swiss double-frame): id/canon badge, `h2.display`, square Avatar + author, body (`rich-read` → Helvetica), tags, "Канонический рейтинг" `<CanonMeter>`, actions:
    - **Vote** `.btn-ghost.btn-sm` "За канон"/"Голос учтён" → `castVote`. Voted state: drop gold → border/text `--ink-max` + filled `★` glyph + `Icon check`. Hover underline-reveal.
    - **Fork** `.btn-primary.btn-sm` "А что, если…" → `goFork`. Inked, invert-on-hover.
  - Character `.card`: "Герои в этой ветке" + `Icon users`; per-char row — square glyph tile, name, `.mono` role, `<StatusPill>` (now ink+glyph, §5.6), "≠ канон" tag when diverged.

### `CanonMeter` & `StatusPill` (shared, used across the tree)
- **CanonMeter:** track `--line-soft`; **fill always `--ink-max`** (drop gold/accent split). Canon vs non-canon shown by label weight + adjacent `★`/"КАНОН" `.mono` tag. `transition:width 1s` kept. Edit the `gold` prop branch in JSX.
- **StatusPill:** drop all `oklch(...hue...)`. Ink-on-`--bg-3`, `1px solid var(--line)`, square. Differentiate by **glyph + label** only: Жив `●`(outline), Мёртв `✕`, Пропал `?`, Изменён `≠` — `.mono --fs-micro` UPPERCASE. Edit `CHAR_STATUS` hue usage in JSX.

**FORWARD/BACK for this screen:** the global `.navctl-back` pops the route stack (→ Catalog/Landing). In-content: the breadcrumb path row (`.path-crumb` buttons → `setSel`) stays as **secondary** intra-tree navigation (square hairline, invert-on-hover, `›` separators in `--ink-3`). Read/Map mode toggle (below, in Reader) is the primary forward affordance into reading.

**States:** Loading (`useStoryNodes`) → grayscale skeleton tree (placeholder squares on hairline edges). Empty (no nodes) → `.mono`/`--ink-3` "Дерево пусто." Error → seed fallback notice. **A11y:** `.tnode` are buttons — full keyboard reachability; arrow-key pan optional but at minimum Tab order follows tree order; selected node `aria-current`. Drag-to-pan is pointer-only — keep keyboard scroll of `.tree-scroll`. Reduced-motion: kill width-transition easing nicety only if it animates layout (canon-meter 1s width stays — it's content, acceptable; gate behind reduce → instant).

---

## SCREEN 5 — READER (reading column + vote/fork + font-scale, app.jsx ~L918+)

`.navctl` present. Two sub-modes: **Read** (`ReadingColumn`) and **Map** (Screen 4). Reader header + mode toggle wrap both.

### Story header (Reader top)
- **BEFORE:** Book `<select.mono>` → `go('reader',{story,node:null})`; "новая книга" `.path-crumb`+`Icon plus` → compose; eyebrow "Древо истории · @author"; `h1.display` title; synopsis; stats Соавторов/Ветвей.
- **AFTER:** Bottom-rule = `--rule-hard`. Book `<select>` → restyled `.mono` square input, `1px solid var(--line)`, `--ink`, focus border→`--ink-max` (no glow); label "КНИГА" `.mono`/`--ink-3`. "новая книга" → square hairline `.path-crumb`, invert-on-hover, `Icon plus` stroke 1.25 → `go('compose',{newBook:true,forkFrom:null})`. Eyebrow `.mono +0.2em`. Title `--fs-d3` grotesque. Synopsis Helvetica `--ink-2`. Stats `.display --fs-h1` numbers + `.mono` labels.

### Mode toggle (segmented pill)
- **BEFORE:** `1px var(--line)` pill, "Чтение" (`Icon eye`) / "Карта ветвей" (`Icon branch`); active = accent bg / accent-ink.
- **AFTER:** Square segmented control, hairline divider between; active = **ink-fill** `--ink-max`/`--accent-ink` (drop accent); inactive invert-on-hover. Icons stroke 1.25. `aria-pressed` per segment.

### `ReadingColumn` (read mode)
| Element | BEFORE | AFTER |
|---|---|---|
| **Canon-path breadcrumb** | `.mono` "путь канона:"; ancestor `.path-crumb` buttons, color accent(current)/gold(canon)/`--ink-2`; `›` separators. | Drop color: current = `--ink-max` 700, canon = `--ink-max` + `★` glyph, rest = `--ink-2`. Square hairline crumbs, invert-on-hover. Separators `--ink-3`. → `setSel`. |
| **Font-scale controls** | Two `.icon-btn` 30×30 (display font) "А−"/"А+"; `setScale(±0.1)` clamp [0.85,1.6], persists `wyrm.readScale`. | Square `36×36` icon-btns, `1px solid var(--line)`, invert-on-hover; "А−"/"А+" in `--display` grotesque. Behavior + clamp + persistence **unchanged**. `aria-label` "Меньше"/"Больше" kept; add `aria-live` polite announcing the new scale %. |
| **Article** | `max-width:40rem`, `font-size:fontScale em`; meta `.mono` line + canon/branch badge; `h2.display` title; Avatar+author; body `div.serif.rich-read` (or `<p.serif>`); tags. | Column → `--read-w` (66ch) / keep 40rem; body **serif → `--ui` Helvetica**, `--fs-read` 18px, `line-height:1.6` (serif retired §2.5; optional `body.reading-serif` opt-in re-points `--serif` for Reader only). Meta `.mono`; canon badge `Icon star`+"каноничная линия" / branch badge `Icon branch`+"ветвь · вне канона" — ink, no gold. Title grotesque `--fs-h1`. Avatar square. Tags restyled. `blockquote` left rule → `2px solid var(--ink-max)`. |
| **Action row** (`btn btn-ghost btn-sm` ×3) | "За канон"/"Голос учтён" (→`vote`, gold when voted, `star`→`check`); "А что, если…" (→`goFork`, `fork`); "Назад" (→`setSel(parent)`, only if path>1, `arrowL`). | All square hairline ghost buttons, invert-on-hover. **Vote voted-state** drops gold → `--ink-max` border+text + `Icon check` + `★`. **Fork** `Icon fork`. **"Назад"** (intra-tree, `setSel(parent)`) kept as in-content back — distinct from `.navctl-back` (which leaves the screen); label it "↑ выше по дереву" to disambiguate, `Icon arrowL` stroke 1.25. |
| **"Что дальше" continuation** | Top-rule section. No-children → serif-italic "Здесь история обрывается…" + `.btn-primary` "Написать продолжение" (`quill`). Canon child → gold-bordered `.card`+canon-glow "ДАЛЬШЕ ПО КАНОНУ". Alt children → header "развилки…(N)" + `.story-card` per alt with CanonMeter. | Top rule = `--rule-hard`. Obrýv copy → Helvetica italic. Continuation primary inked. **Canon-child card** drops gold border + glow → `2px solid var(--ink-max)` + filled `★` corner marker + "ДАЛЬШЕ ПО КАНОНУ" `.mono`; flat, no glow; invert-on-hover. **Alt-children** `.story-card`s → flat hairline, border-darken hover, inline `<CanonMeter>` (ink fill). All → `setSel`. |

**FORWARD/BACK:** `.navctl-back` = leave Reader (pop stack). In-content "Назад/↑ выше" = walk up the tree (`setSel(parent)`). Mode toggle = forward into Map. Continuation cards = forward into next node. Book `<select>` = switch story (`go('reader',...)`, pushes stack).

**States:** Loading (`useStoryNodes`) → grayscale article skeleton (placeholder `--bg-3` bars at `--fs-read` line-height). Empty/missing node → `.mono`/`--ink-3` "Глава не найдена" + back crumb. Error → seed fallback. **A11y:** font-scale persists + announced; breadcrumb buttons keyboard-reachable; article is a landmark `<article>`; `aria-current` on the active node in breadcrumb; reduced-motion kills viewIn/grain (canon-meter width transition gated to instant).

---

## SCREEN 6 — COMPOSE (chapter/branch editor + character fates, app.jsx ~L918+ fork/newbook)

`.navctl` present. Two modes: `newbook` | `fork`. Autosaves to `wyrm.draft`/`wyrm.draftNotes` (unchanged).

### ModeToggle (segmented)
- **BEFORE:** `btn btn-sm` "Новая книга"/"Дописать существующую"; active bg=accent.
- **AFTER:** Square segmented, active = ink-fill (drop accent), inactive invert-on-hover. `aria-pressed`.

### Done screen
- **BEFORE:** `Icon crown`/`branch`; heading "Книга создана"/"Ветка опубликована"; `.btn-primary` "Открыть книгу"/"К древу" (→reader); `.btn-ghost` "Ещё книгу"/"Ещё ветку" (→resetForm).
- **AFTER:** Icons stroke 1.25; heading grotesque `--fs-d4`. Primary inked invert-on-hover → `go('reader',{story,node})`. Ghost underline-reveal → `resetForm`. Card flat hairline, no shadow; entry `scale(.985)→1` over `--t-snap`.

### Newbook mode (`compose-grid 1fr 320px` → unify rail to 340px, collapse @800px)
| Element | BEFORE | AFTER |
|---|---|---|
| **Title** `input.compose-input.display` | Rounded input, "Название книги". | Square, `1px solid var(--line)`, grotesque display `--fs-d4`, `--ink`, mono placeholder `--ink-3`; focus border→`--ink-max` over `--ms-color`, no glow ring. |
| **Synopsis** `textarea.compose-input` rows 2 | Rounded. | Square hairline, Helvetica, same focus. |
| **First chapter** `<RichEditor>` | Toolbar + contentEditable `.serif.rich-edit`; tools Ж/К/H/❝/•—/⌫; import .txt/.docx. | Body serif→`--ui`. **`.edit-tool` buttons:** square `1px solid var(--line)`, `.mono`, invert-on-hover, active-tool = ink-fill. Import `.btn-ghost` "Импорт .txt/.docx" → underline-reveal; busy/error status `.mono`/`--ink-3`. `blockquote` rule → `2px solid var(--ink-max)`. Word-count line `.mono`. |
| **Genre wheel card** `<GenreWheel multi size=236>` | SVG sectors filled `oklch(0.7 0.15 hue/α)`, selected pops out, brighter stroke. | **Option A:** sectors fill `--ink` at varying **alpha** (0.22 idle / 0.55 hover / 0.95 selected); selection reads via alpha + pop-out, no hue; stroke `--ink-max` thicker when selected. `atMax` (≥4) → `cursor:not-allowed`. Center label grotesque, count `.mono`. Selected `<Tag>`s = square ink-square-dot. |
| **Cover card** | `<img>` preview; `<label.btn-ghost.btn-sm>` "Загрузить/Заменить" wrapping hidden file input; `Icon eye`. | Preview `filter:grayscale(1) contrast(1.05)`; label = ghost button underline-reveal; hatch placeholder when empty. |
| **Community card** `<select.mono>` | "— без сообщества —" + communities. | Square hairline `.mono` select, focus border→`--ink-max`. |
| **Publish** `.btn-primary` "Опубликовать книгу" | Accent fill, disabled unless `title.trim()&&plain`; `Icon crown`. | Inked square, invert-on-hover; disabled = `--bg-3` bg + `--ink-3` text + `cursor:not-allowed` (no color). `Icon crown` stroke 1.25. |

### Fork mode — writer's desk
**Desk bar (`.desk-bar`):**
- **"К древу" `.icon-btn`** (→`go('reader',{story})`, `Icon arrowL`): this is the existing per-screen back. Fold its role into `.navctl-back` as canonical; keep the desk-bar icon-btn as a **secondary** square hairline back, invert-on-hover, label/title "К древу". Remove the blur on `.desk-bar` → opaque `--bg` + bottom `--rule-style`.
- **Panel toggles `TOGGLES`** ("Навигатор"/"Свойства"/"Заметки"/"Фокус", `btn btn-sm desk-toggle` `data-on`): square; `data-on` = ink-fill `--ink-max`/`--accent-ink`; off = hairline; invert-on-hover; icons (branch/sliders/quill/eye) stroke 1.25. `aria-pressed`.
- **Preset `<select.mono>`** "пресет раскладки…" → square hairline select, applies `p.cfg`.
- **"＋ сохранить" `.path-crumb`** → `savePreset` (prompts name); square hairline mono, invert-on-hover.
- **Word-goal meter** (when `goal>0`): `.mono words/goal` + bar; **gold-at-100% → `--ink-max` fill** at 100% (drop gold). Track `--line-soft`.
- **Publish `.btn-primary.btn-sm`** "Опубликовать" → `publish`; disabled unless `plain`; inked; `Icon branch`.

**Desk dock grid (`.desk`, cols from left/right/focus):**
- **Left dock — chapter navigator** (`left && !focus`): `.desk-navitem` per node, `data-on`=is-parent, indented by depth, `Icon star`(canon)/`branch` stroke 1.25, title → `setCtx({forkFrom,story})` (re-roots fork parent). Square hairline rows; `data-on` = ink-fill; invert-on-hover.
- **Center — canvas `<main>`:**
  - Eyebrow "Развилка · а что, если…" `.mono +0.2em`.
  - **Parent-context card** (`border-left accent` today) → `border-left:2px solid var(--ink-max)`; "ветвишься от · глава ID «title»" `.mono`; last 150 chars serif-italic → Helvetica italic, `--ink-2`.
  - **Title** `input.compose-input.display` "Название твоей главы" — as Newbook title.
  - `<RichEditor>` (minHeight 460 focus / 340) — as above.
  - Word-count `.mono`.
  - **Bottom dock — notes** (`bottom && !focus`): `.mono` "Заметки к черновику"; **word-goal `<input type=number>`** → `setDeskCfg({goal})` (square hairline); notes `textarea.compose-input` → `saveNotes`.
- **Right dock — properties** (`right && !focus`):
  - **Genre wheel** `<GenreWheel multi size=224>` + Tags — as Newbook (alpha-ink).
  - **Character-fate card** (if `chars`): per char — name + `<select.mono>` of `CHAR_STATUS` (Жив/Мёртв/Пропал/Изменён) → `setChars` (creates parallel line; original text unchanged). Square hairline selects; the status options carry **no color** — the StatusPill glyph system (§5.6) is the visual key wherever a pill renders.

**FORWARD/BACK:** `.navctl-back` = leave Compose. Desk "К древу" / Done "К древу"/"Открыть книгу" = forward into Reader. ModeToggle = switch compose mode. Left-dock navitems = re-root fork parent (lateral). Preset select = layout change (not nav).

**States:**
- **Loading:** draft restored from localStorage synchronously — no spinner; if `useStoryNodes` (fork parent) pending → grayscale skeleton parent-context card.
- **Empty:** Newbook with no title → publish disabled (state above). Fork with no parent → `.mono`/`--ink-3` "Выбери, от чего ветвишься" + nav back.
- **Error:** publish failure → `.mono`/`--ink-3` inline notice (red dropped → ink, optionally `≠` glyph) below the publish button; autosave guarantees no data loss.

**A11y:** all toggles `aria-pressed`/`data-on` paired; RichEditor toolbar buttons have `aria-label` (Ж=Полужирный, К=Курсив, etc.) since glyphs aren't self-describing; file input reachable via its `<label>`; `<select>`s native (keyboard-OK); focus-visible 2px ink outline everywhere; reduced-motion kills viewIn/grain/invert-animation (invert stays instant). GenreWheel sectors are `<path>` buttons — ensure each has `<title>` (kept) + `role`/`aria-pressed`; `atMax` blocked sectors get `aria-disabled`.

---

## CROSS-SCREEN CHECKLIST (STORY CORE)

1. **Color dropped everywhere in this group:** every `var(--accent)`/`var(--gold)` usage above resolves to `--ink-max` via the compat aliases — no JSX sweep needed for class-styled elements, but **inline `oklch()`/hue in `Tag`, `Avatar`, `CoverSlot`, `StatusPill`, `CanonMeter`, MiniTree, StoryTree edges/nodes, GenreWheel must be edited in JSX** (CSS can't reach them).
2. **Canon = weight + rule + `★` marker**, never hue — applied identically in MiniTree, StoryTree, CanonMeter, breadcrumb, continuation cards.
3. **Square everything** (radius 0): inputs, cards, tags, buttons, avatars, covers, selects.
4. **Invert-on-hover** on: every `.btn`, `.tag-btn`, `.story-card`, `.nav-link`/crumb, `.icon-btn`, `.edit-tool`, `.desk-toggle`, `.desk-navitem`, `.swatch-tile`, GateCorner, MiniTree. **scaleX ink underline** on: sort `.nav-link`, mode/tab segments' inactive→active, `.btn-ghost`.
5. **Global back control** (`.navctl-back` + `routeStack`) is the canonical exit on all five non-Gate screens; existing per-screen crumbs (Reader "Назад"=tree-walk, Compose/desk "К древу", map breadcrumb) demote to secondary in-content links.
6. **Motion:** `--ms-color` for color/border hovers, `--t-snap` for transform/size, `viewIn` on route change, animated `noise` grain + `blink` cursors on eyebrows/captions/live labels. All gated by `prefers-reduced-motion` (grain freezes, blink solid, invert stays instant).
7. **Type:** Space Grotesk display (d1–d5 clamps), Helvetica/Inter UI+body, JetBrains/SFMono labels; serif retired (optional Reader opt-in); tight negative tracking on display, `+0.2em` UPPERCASE mono eyebrows.

**Files to touch:** `/Users/bubble3/Desktop/WYRM - книга/src/styles.css` (tokens, `.card`/`.btn`/`.tag`/`.tnode`/`.story-card`/`.compose-input`/`.edit-tool`/`.desk-*`/`.gate-*` restyle, invert/blink/noise utilities, breakpoint 940→800, rail 340px) and `/Users/bubble3/Desktop/WYRM - книга/src/app.jsx` (inline-`oklch()` removal in `Tag`/`Avatar`/`CoverSlot`/`StatusPill`/`CanonMeter`/`MiniTree`/`StoryTree`/`GenreWheel`, accent-span weight swap in Hero, `routeStack`+`.navctl` wiring, icon `stroke 1.6→1.25`, gold→ink prop branches).

---


<a id="4"></a>

# Раздел 4. Экраны — Social (Feed / Communities / Profile / Auth / Menus)

# WYRM → reframed.online — Redesign Plan: SOCIAL Group

> Screens covered: **Feed** (+ FeedComposer, PostCard, RichEditor, GenreWheel, FEED_KINDS), **Communities** (CommunityCard, Communities list, CommunityCreate, CommunityDetail), **Profile**, **Social** (hub), **AuthModal**, **NotificationsMenu**, **AccountMenu**.
>
> All values are literals from the canonical design system: ink `--ink #262626` / `--ink-max #000` (flips to `#e8e8e8`/`#fff` in `inverted`), surfaces `--bg/--bg-2/--bg-3`, hairlines `--line/--line-soft/--line-hard`, radius `0`, type `--fs-*`, motion `--ms-color 125ms ease-out` (color/bg) + `--t-snap .2s cubic-bezier(.55,.085,.68,.53)` (transform), invert-on-hover via `.invert-hover`, film grain on every route via `.atmos::after`. **Color is dropped**; `var(--accent)`/`var(--gold)` resolve to `--ink-max`. Genre `hue` → **Option A grayscale** (6px ink square dot, alpha-driven wheel, grayscale hatch banners). Every screen inherits the **global `.navctl` back control** (§5.2) — so per-screen ad-hoc crumbs become secondary.

A recurring decision applies everywhere below: **heavy inline `style={}` objects carrying `oklch()`/`hue`/`blur`/`radius`/`shadow` must be edited in JSX** — CSS-only will not reach them. Each block flags the inline edits.

---

## 0. Shared social primitives — applied identically across Feed / CommunityDetail / Profile

These are restyled once and reused; later blocks reference them.

### `.card` (post/community/profile surface)
- **BEFORE:** translucent `--panel`, `backdrop-filter:blur(8px)`, `--r-card:14px`, soft shadow, `.5s` hover.
- **AFTER:** opaque `var(--panel)`, **no blur, no shadow**, `border:1px solid var(--line)`, `border-radius:0`. Interactive cards (story-card, community-card, post-as-link) get `.invert-hover` OR a border-darken (`border-color:var(--ink-max)`) over `--ms-color`. Drop every `translateY(-6px)` lift → replace with border-darken + a max `2px` nudge. Internal padding standardizes to `--sp-5 (24px)`; tight rows use `--sp-2/--sp-3`.

### `.tag` / `.tag-btn` / `.dot` (used as kind chips, genre chips, action-bar buttons, community chips)
- **BEFORE:** `999px` pill, colored `oklch` dot, accent active fill.
- **AFTER:** square (`--r-pill:0`), `1px solid var(--line)`, `--fs-meta (12px)`, **mono UPPERCASE** label. `.dot` → **6px solid `var(--ink)` square** (inline `background:oklch(...)` in `Tag` JSX replaced). `data-active` → filled: `background:var(--ink-max); color:var(--accent-ink); border-color:var(--ink-max)`. `.tag-btn` gets `.invert-hover`. Color transitions on `--ms-color`.

### `Avatar`
- **BEFORE:** circular monogram, inline only.
- **AFTER:** **square** (`border-radius:0`), `1px solid var(--line)`, `background:var(--bg-3)`, mono initial in `--ink-2`. Edit the inline style object in `Avatar` JSX. Reads as a lab/index-card monogram.

### `.compose-input` / `.auth-input` / `<textarea>`
- **AFTER:** square, `1px solid var(--line)`, `background:var(--bg)`, `--ink` text, **mono placeholder in `--ink-3`**. Focus: `border-color:var(--ink-max)`, no glow ring, `--ms-color`.

### `.nav-link` (filter/tab idiom — Feed tabs, Social tabs, Profile tabs, CommunityDetail back)
- **AFTER:** unify to the **scaleX ink underline** idiom (tabs/nav). `::after` is a `1px` `var(--ink-max)` bar, `transform:scaleX(0)→1` on `[data-active]`/hover over `--ms-color`; label `--fs-ui-sm`, ink text. (Buttons use ink-fill + invert; tabs/nav use this underline — the two idioms that replace the four divergent active states.)

---

## 1. SOCIAL (hub) — `Social({ go, user, initial })`

| Element | BEFORE | AFTER | CONTROLS | A11Y |
|---|---|---|---|---|
| Root `.view` | Plain container, `viewIn` translateY. | `.view` keeps `viewIn .32s var(--ease)`; grain rides via global `.atmos::after` (animated `noise`). | — | Respects reduced-motion (anim → `.001ms`, grain static). |
| Header eyebrow + title | Eyebrow "Что пишет сообщество…" + `.display` "Сообщество". | Eyebrow → `.eyebrow` mono `+0.2em` UPPERCASE `--ink-3`, optionally suffixed `<span class="blink">▋</span>`. Title → `--fs-d2` (48→85px), display 400, tracking `-0.0208em`, line-height `0.9`. Generous top pad `clamp(--sp-8,9vw,--sp-11)`. | — | `<h1>` single; eyebrow `aria-hidden` on the blink span only. |
| Tab row (Лента / Сообщества) | `.nav-link` `data-active`, accent underline. | `.nav-link` scaleX **ink** underline idiom (shared §0). Active = full-width ink bar; idle = collapsed. Hover reveals at 50% via `--ms-color`. Tabs sit on a `--rule-style` baseline rule. | Tabs: `setTab`; keyboard arrow-left/right to move between, Enter/Space activate. | `role="tablist"` / `role="tab"` with `aria-selected`; underline is `aria-hidden`. |
| Body | `<Feed embedded>` / `<Communities embedded>`. | Unchanged switch; both inherit restyles below. Crossfade between tabs optional via `viewIn` on the body wrapper. | — | Focus moves to panel heading on tab change (`role="tabpanel"`, `tabindex=-1`). |

---

## 2. FEED — `Feed({ go, user, embedded })`

### 2.1 Feed shell
- **BEFORE:** `.view.wrap` max-width 760; optional header (hidden when embedded); composer → filter tabs → post column → "ещё".
- **AFTER:** Column max-width tightens to a true reading measure; `.wrap = min(100% - 48px, 720px)` for the feed. Standalone header gets the §1 eyebrow+`--fs-d2` title treatment. Vertical rhythm between cards = `--sp-5 (24px)`. Section is flanked by hairline rules top/bottom only on standalone.
- **A11Y:** post list is a `<ul>`/`<li>` (or `role="feed"` with `aria-busy` during load); each card `role="article"`.

### 2.2 Filter tabs — `all / following / branch / vote / discuss / post`
- **BEFORE:** `.nav-link` `data-active`, accent underline; maps to `feedFilter`.
- **AFTER:** scaleX ink-underline `.nav-link` idiom (§0). Labels stay (Всё/Подписки/Ветви/Голоса/Споры/Записи) but render `--fs-ui-sm` UPPERCASE-optional. Active tab = ink underline + `--ink-max` text; inactive = `--ink-2`. Tabs wrap on a hairline baseline; horizontal scroll on ≤480 (no wrap collapse).
- **CONTROLS:** click → `setFilter`; **keyboard:** arrow keys cycle, Home/End jump. Following tab when `authors:[]` empty → shows empty state (below). Loading first page → skeleton (below).
- **A11Y:** `role="tablist"`; each `aria-selected`; reduced-motion → underline appears instantly (opacity, no scaleX animation).

### 2.3 `FeedComposer` (top of Feed + inside CommunityDetail)

**Logged-out state** (L3095–3101)
- **BEFORE:** `.card` row, prompt text + "Войти и писать" `.btn-primary.btn-sm` → `go('landing')`.
- **AFTER:** flat hairline `.card`, square, `--sp-5` padding. Prompt `--ink-2` `--fs-body`. Button → square ink-fill `.btn-primary`, invert-to-outline on hover over `--ms-color`. Edit inline `padding/marginBottom`; keep `gap`.
- **A11Y:** button is the only focusable; visible focus ring = `2px` ink outline offset 2px.

**Logged-in composer** (L3108–3135)
| Element | BEFORE | AFTER | CONTROLS / states | A11Y |
|---|---|---|---|---|
| Wrapper `.card` | blur card, 18×20 pad, `marginBottom:26`. | Flat hairline square card, `--sp-5` pad. Edit inline. | — | `role="form"`, `aria-label="Новая запись"`. |
| `Avatar` (36) | circle. | Square monogram (§0). | — | `alt`/`aria-label` = handle. |
| `<textarea.compose-input>` | 3 rows, vertical resize, `minHeight:64`. | Square, hairline, mono placeholder `--ink-3`, `--ink` text `--fs-body`. Focus → `--ink-max` border. Keep resize. | Enter inserts newline (not submit); typing enables publish. | Labelled by composer; placeholder not sole label — add `aria-label`. |
| Kind chips ×4 (FEED_KINDS) | `.tag.tag-btn` `data-active`, icon+label, accent fill active. | Square mono chips (§0). Icon stroke 1.25. Active = ink-fill; idle = hairline. `.invert-hover`. Single-select group. | `setKind`; only one active. | `role="radiogroup"`; chips `role="radio"` `aria-checked`. Arrow keys move within. |
| "Жанры" toggle chip | `.tag.tag-btn` `data-active` when open/has tags, count suffix. | Same square chip; star icon → ink. `data-active` ink-fill when tray open or tags chosen. | Toggles `showTags`; suffix `· N`. | `aria-expanded`, `aria-controls` → tray id. |
| "Опубликовать" primary | `.btn-primary.btn-sm`, `marginLeft:auto`, quill icon, disabled when empty. | Square ink-fill button; disabled = `--ink-3` text on `--bg-3`, `not-allowed` cursor, no invert. Enabled hover = invert-to-outline. | `submit`; disabled `!text.trim()`. | `aria-disabled` mirrors `disabled`; disabled removed from tab order only if truly inert (keep focusable, announce). |
| Genre tray (`showTags`) | flex-wrap `<Tag asButton>` per `window.WYRM.TAGS`, top rule. | Square genre chips, 6px ink-square dot, ink-fill when selected. Top `--rule-style` divider, `--sp-3` gap. Max 3 enforced. | `toggleTag` (cap 3); over-cap clicks ignored (cursor unchanged — or `not-allowed` on unselected when at 3). | Tray `id` matches `aria-controls`; `role="group"` "Жанры (макс. 3)"; reaching cap announced via `aria-live="polite"`. |

### 2.4 `PostCard` (L3140–3258) — reused by Feed, CommunityDetail, Profile

| Element | BEFORE | AFTER | CONTROLS / states | A11Y |
|---|---|---|---|---|
| `<article.card.reveal>` | blur card, shadow, radius 14. | Flat hairline square `.card`, `--sp-5` pad, no blur/shadow. `.reveal` transform-only entrance. | — | `role="article"`, `aria-labelledby` → author+kind. |
| "репост" pill | inline pill, fork icon. | Mono `--fs-micro` UPPERCASE eyebrow row, fork icon ink 1.25, `--ink-3`. Square. Edit inline. | display only | `aria-hidden` decorative icon. |
| Header: `Avatar`(34)+author+kind | circle avatar; author name; kind label. | Square avatar; author `--fs-ui-sm` `--ink-max`; kind badge mono `--fs-micro` UPPERCASE `--ink-3`. Timestamp mono `--fs-micro` `--ink-3`, right. | — | Author is a heading-level link if it navigates; else text. |
| Follow pill (header, `canFollow`) | inline pill "✓ вы подписаны" / "+ подписаться". | Square hairline `.tag`-style button, mono UPPERCASE. Followed = ink-fill (`✓ ПОДПИСАНЫ`); not = outline (`+ ПОДПИСАТЬСЯ`). `.invert-hover`. | `onFollow(post.author)`; toggle. | `aria-pressed` reflects follow state; label changes announced. |
| Community chip | `.tag.tag-btn` users-icon + name → `go('community')`. | Square mono chip, `.invert-hover`, ink. | navigates to community | link semantics; `aria-label`="Сообщество: {name}". |
| Body `<p>` text | serif/body. | `--ui` (serif retired), `--fs-read (18px)` if standalone reading, else `--fs-body (16px)`, line-height 1.5, `--ink`. | — | — |
| Story-ref crumb | `.path-crumb` branch/arrow → reader. | Mono `--fs-meta` UPPERCASE, ink, `.invert-hover`, square hairline pad. Icons 1.25. | `go('reader',{story,node})` | link; descriptive `aria-label` with chapter. |
| Tag row | `<Tag>` per tag. | Square 6px-ink-dot tags (§0). | display | — |
| **Action bar** (borderTop) | row, `--rule-style` top. | Top `--rule-style` hairline; buttons mono `--fs-meta`, icon 1.25, `--sp-3` gaps. All four use **flat ink-fill active** + `.invert-hover` on hover. | — | `role="group"` "Действия". |
| — Like | `.tag.tag-btn` flame + count, `data-active=likedByMe`. | Square chip; active = ink-fill; flame ink. Optimistic flip on `--ms-color`. | `onReact(id,'like')` | `aria-pressed=likedByMe`; count in `aria-label`. |
| — Comments | users icon + count, `data-active=openC`. | Same chip; active (open) ink-fill. | `toggleComments` (lazy load). | `aria-expanded` → comments block id. |
| — Repost | fork + count, one-shot, disabled if !user/reposted. | Same chip; disabled = `--ink-3`/`not-allowed`, no invert. Active once reposted = ink-fill. | `doRepost` one-shot. | `aria-disabled`; announce "Репост сделан". |
| — Save/bookmark | star + count, `marginLeft:auto`, `data-active=savedByMe`. | Right-pushed square chip; star ink; active ink-fill. | `onReact(id,'save')` | `aria-pressed=savedByMe`. |
| — Delete (`canModerate`) | `.icon-btn` x, `confirm()`. | 36×36 square `icon-btn`, hairline, `.invert-hover`, x ink 1.25. | `confirm('Удалить пост?')`→`onDelete`. | `aria-label` distinguishes "Удалить (модерация)"; confirm dialog focus-managed by browser. |
| **Comments block** (`openC`) | list rows + composer / login prompt. | Indented hairline-topped block, `--sp-4` pad. Rows: square `Avatar`(26), `@author` `--fs-ui-sm`, time mono `--fs-micro` `--ink-3`, text `--fs-body`. | — | `id` ties to comments toggle `aria-controls`; `aria-live="polite"` on append. |
| — Comment input | `.compose-input`, Enter submits, "Ответить" btn. | Square hairline input, mono placeholder; Enter submits. "Ответить" square ink-fill `.btn-sm`. | `submitComment`→`store.addComment`. | input `aria-label`="Комментарий"; Enter behavior documented in helper text (sr-only). |
| — Empty comments | "Комментариев пока нет." | Mono `--fs-meta` `--ink-3`, centered. | — | `aria-live` region. |
| — Logged-out comment | "Войди, чтобы комментировать." | Mono `--ink-3`, optional "Войти" `.btn-ghost.btn-sm` (underline-on-hover). | → `go('landing')`. | focusable login link. |

**Loading state (card-level):** while feed page 1 loads, render **skeleton cards** — flat `var(--bg-3)` rectangles with the diagonal hatch (`repeating-linear-gradient(135deg,var(--bg-2) 0 8px,var(--bg-3) 8px 16px)`), no spinner; `aria-busy="true"` on the feed container.
**Error state:** optimistic like/save/repost revert on error (already in `useFeed`); surface a transient mono `--fs-meta` line "Не удалось — повторите" via `aria-live="assertive"`; no color, ink only.

### 2.5 `RichEditor` (L3261–3331) — also used in Compose; restyled here for completeness
| Element | BEFORE | AFTER | CONTROLS | A11Y |
|---|---|---|---|---|
| Toolbar | row of `.edit-tool` buttons + import. | Square hairline `.edit-tool` buttons, mono glyphs, `.invert-hover`, icon/letter ink. `onMouseDown` preventDefault preserved. Active formatting state = ink-fill. | `exec(cmd)` per tool: Ж/К/H/❝/•—/⌫. | `role="toolbar"`, each button `aria-label` (e.g. "Полужирный"); `aria-pressed` for toggle formats. |
| Import button | `.btn.btn-ghost` "Импорт .txt / .docx". | Square ghost button, underline-on-hover, ink. | hidden file input `.txt,.md,.markdown,.docx`. | `aria-label`; busy status `aria-live`. |
| `contentEditable` `.rich-edit` | serif body, placeholder, minHeight 320. | `--ui` (serif retired → Helvetica), `--fs-read`, `--ink`. Square `1px solid var(--line)`, focus → `--ink-max` border. Mono placeholder `--ink-3` via `:empty:before`. **blockquote left rule `2px solid var(--ink-max)`** (was accent). | type/format. | `role="textbox" aria-multiline`, labelled; placeholder also `aria-label`. |
| Busy line | progress/error string. | Mono `--fs-meta` `--ink-3`; error same (ink, no red). | — | `aria-live="polite"`. |

### 2.6 `GenreWheel` (L3334–3378) — used by CommunityCreate (multi, max 3)
- **BEFORE:** SVG ring; sectors filled `oklch(0.7 0.15 hue / α)` (α .95/.55/.22), selected pops out, brighter+thicker stroke; center label.
- **AFTER (Option A grayscale):** sectors fill **`var(--ink)` at varying alpha** — `0.22` idle / `0.55` hover / `0.95` selected (replace the `oklch` fill expression in JSX with `currentColor`/`var(--ink)` + alpha). Stroke `var(--line)` idle → `var(--ink-max)` `1.5px` selected. Selection still reads via **alpha + pop-out** (`ro = R+5`), no hue. Center top label = active genre `--fs-ui` display; bottom mono `--fs-meta` `N / max выбрано`. `atMax` unselected sectors `cursor:not-allowed`, click ignored.
- **CONTROLS:** click sector → `onToggle`; hover → `setHover`; cap 3 blocks unselected. Motion: fill alpha + pop-out transition on `--t-snap`.
- **A11Y:** wheel wrapped as `role="group"` "Круг жанров"; **each sector keyboard-focusable** (`tabindex=0`, Enter/Space toggles) since SVG paths aren't natively focusable — add `role="button"` + `aria-pressed` + `aria-label`={genre}. Reduced-motion → pop-out is instant. `<title>` tooltips retained.

---

## 3. COMMUNITIES — `Communities({ go, user, embedded })`

### 3.1 Communities list shell
| Element | BEFORE | AFTER | CONTROLS | A11Y |
|---|---|---|---|---|
| Root `.view.wrap` | embedded vs standalone padding. | Keep branch; standalone pad `clamp(--sp-8,9vw,--sp-11)` top. | — | — |
| Embedded header | mono count + small "Создать сообщество". | mono `--fs-meta` `--ink-3` count; button square ink-fill `.btn-sm`, plus icon 1.25. | `setCreating(true)` | button focusable. |
| Standalone header | `.eyebrow` + `.display` clamp(2.4–4.4rem) title + big create btn. | Eyebrow mono `+0.2em`; title → `--fs-d2`; big "Создать" square ink-fill `.btn`, invert-to-outline hover. | `setCreating(true)` | `<h1>` single. |
| Grid | `auto-fill minmax(300px,1fr)`, gap 24. | Same grid; gap → `--sp-5`. Cards are flat hairline (§3.2). | — | grid is a `<ul>`/`<li>`. |
| Empty state (no communities) | — (none today). | **Add:** centered mono `--fs-meta` "Пока нет сообществ" + "Создать первое →" ghost button. | → `setCreating`. | `aria-live` region. |
| Loading | `loading` flag unused in UI. | **Add** skeleton hatch tiles (grayscale diagonal), `aria-busy`. | — | — |

### 3.2 `CommunityCard` (L3456–3478)
| Element | BEFORE | AFTER | CONTROLS | A11Y |
|---|---|---|---|---|
| `.reveal.story-card.card` | float-lift card, overflow hidden. | Flat hairline square card; drop `translateY` lift → border-darken/`.invert-hover`. Edit inline. | — | `role="article"`. |
| Banner button | 96px, `oklch` linear+radial gradient by `c.hue`, name overlaid. | **Grayscale diagonal hatch** `repeating-linear-gradient(135deg,var(--bg-2) 0 8px,var(--bg-3) 8px 16px)` (replace both inline `oklch` gradients). Name in `.display` `--fs-d5`-ish (`1.5rem`→ keep, or scale up), **`mix-blend-mode:difference`** so it survives the hatch. Bottom `--rule-style` divider. Banner hover: `filter:none`/invert reveal beat. | `onOpen` → `go('community')`. | banner is a `<button>` with `aria-label`="Открыть сообщество {name}". |
| Blurb `<p>` | `--ink-2` `.9rem`. | `--ui` `--fs-body` `--ink-2`, line-height 1.5. | — | — |
| Tag row | `<Tag>` per tag. | Square 6px-ink-dot tags. | display | — |
| Footer: member count | mono `.58rem` users-icon + count. | mono `--fs-micro` UPPERCASE `--ink-3`, icon 1.25. | display | count in text. |
| Join/Leave button | `btn-primary` "Вступить" / `btn-ghost` "✓ Вступил". | Joined = ghost outline `✓ ВСТУПИЛ` (check 1.25); not = square ink-fill "ВСТУПИТЬ". `.invert-hover`. Optimistic. | `onToggle`→`toggleJoin`. | `aria-pressed`=joined; revert-on-error announced. |

### 3.3 `CommunityCreate` (L3518–3580)
| Element | BEFORE | AFTER | CONTROLS / states | A11Y |
|---|---|---|---|---|
| `.card.framed` `.compose-grid` (minmax(0,1fr) 280px) | two-col, sticky preview aside. | `.card.framed` → **pure-ink Swiss double-frame** (outer hairline + 4px inset hairline), square, no gilt. Grid collapse retargets to **800px**. | — | `role="form"` `aria-label`="Создать сообщество". |
| Logged-out | prompt + "Войти". | mono prompt `--ink-3` + ghost "Войти" → `go('landing')`. | — | focusable login. |
| НАЗВАНИЕ input | `<input>`. | Square hairline `.compose-input`, mono placeholder; focus ink border. | `setName` | labelled by mono field label (§Field). |
| О ЧЁМ textarea | 3 rows. | Square hairline, resize, mono placeholder. | `setBlurb` | labelled. |
| КРУГ ЖАНРОВ · до 3 | `<GenreWheel multi max3 size228>`. | Grayscale wheel (§2.6), keyboard-focusable sectors. | `toggleTag` cap 3. | `role="group"` cap announced. |
| ЦВЕТ ОБЛОЖКИ range | `<input type=range>` 0–340 step20 → hue. | **Repurpose or remove.** Banners are grayscale now → hue picker is meaningless. **Recommend removing** the field; if kept for data compat, relabel "Узор обложки" and map to a **hatch angle/density** (0–340 → angle) instead of hue. Range thumb = square `12×12 var(--ink-max)`, square track `var(--line)`. | `setHue` (now drives pattern, not color). | If removed, drop from tab order; if kept, slider `aria-label`="Узор обложки", `aria-valuetext`. |
| Preview aside (sticky) | mirrors hue banner. | Mirrors **grayscale hatch** banner + name (`difference`) + blurb + tags. Sticky `top:84`. | live | `aria-hidden` decorative? No — keep readable; mark "предпросмотр". |
| Отмена / Основать | ghost / primary (disabled until name). | Отмена = ghost underline-hover; Основать = square ink-fill, disabled `--ink-3`/`not-allowed`. | `onClose` / `onCreate`. | disabled `aria-disabled`; on create, focus moves to new community page. |

### 3.4 `CommunityDetail` (L3583–3684)
| Element | BEFORE | AFTER | CONTROLS / states | A11Y |
|---|---|---|---|---|
| Root `.view` + banner | full-width `oklch` hue banner; `.wrap` overlaps `marginTop:-56`. | Banner = **grayscale diagonal hatch**, full-bleed; height generous. `.wrap` overlap kept. Replace inline `oklch`. | — | banner `aria-hidden` (decorative); name repeats in header. |
| **Back link "Все сообщества"** | `.nav-link` arrowL → `go('communities')`. | **Demote to secondary**: the **global `.navctl-back`** corner control is canonical ("← НАЗАД", pops `routeStack`). Keep this in-content link as a secondary mono `.path-crumb` "← ВСЕ СООБЩЕСТВА" with `.invert-hover`, arrowL 1.25. | global back pops stack; in-content → `go('communities')`. | both reachable by keyboard; global control is first in tab order top-left. Forward not needed. |
| Header `.card.framed` | title/blurb/tags/stats + join + delete. | Swiss double-frame (ink), square. Title `--fs-d3`. Blurb `--fs-body` `--ink-2`. | — | `<h1>` = community name. |
| Stats (Участников/Историй/Основатель) | inline numbers. | Numbers `.display` `--fs-h2`; labels mono `--fs-micro` UPPERCASE `--ink-3`. Hairline separators. | — | each stat a labelled group. |
| Join/Leave big button | "Вступить"/"Вы участник". | Square ink-fill (join) / ghost outline (member). `.invert-hover`. Optimistic. | `toggleJoin`. | `aria-pressed`. |
| Delete community (`canManage`) | `.path-crumb` x + `confirm`. | Mono `--fs-meta` ink `.invert-hover`, x 1.25; `confirm` → `deleteCommunity` → `go('communities')`. | confirm gate. | `aria-label`="Удалить сообщество"; destructive — no color, relies on confirm. |
| "Книга в сообществе" | → compose with community ctx. | Square ink-fill `.btn-sm`, quill/branch icon 1.25. | `go('compose',{community})`. | focusable. |
| "Истории сообщества" section | story cards → reader. | Section header mono eyebrow + `--rule-hard` top rule. Story cards flat hairline, `.invert-hover`, square `CoverSlot` grayscale hatch. | `go('reader',{story})`. | grid `<ul>`. |
| — Empty stories | (none). | **Add** mono `--ink-3` "Историй пока нет". | — | `aria-live`. |
| "Обсуждения" section | `FeedComposer` (discuss) + feed + load-more. | Composer (§2.3) `defaultKind="discuss"`; PostCards (§2.4, no community chip/follow). Load-more square ghost. | `addPost({community})`, `loadMore`. | section `role="region"` "Обсуждения". |
| Not-found fallback | renders fallback if community missing. | Centered mono `--fs-meta` "Сообщество не найдено" + "← Все сообщества" ghost. | → `go('communities')`. | focusable, `aria-live`. |

---

## 4. PROFILE — `Profile({ go, user })`

| Element | BEFORE | AFTER | CONTROLS / states | A11Y |
|---|---|---|---|---|
| Logged-out | centered prompt + "На главную". | Centered mono `--ink-3` prompt + square ghost "На главную" → `go('landing')`. | — | focusable. |
| Header `.card.framed` | avatar upload, name/handle, mod badge, 3 stats. | Swiss double-frame (ink), square. | — | `role="region"` "Профиль". |
| Avatar upload `<label>` | circle `Avatar`/`<img>` + camera badge (eye) + hidden file input. | **Square** avatar/img (grayscale `filter:grayscale(1)` on user img to join the system; hover `filter:none` reveal), `1px solid var(--line)`. Camera badge = square hairline tile, eye icon 1.25, ink. Hover `.invert-hover`. | `onAvatar`→`store.updateAvatar`. | `<label>` wraps input; `aria-label`="Сменить аватар"; keyboard-activates file dialog. |
| Name / handle | name + `@handle`. | Name `--fs-d4` display; handle mono `--fs-meta` UPPERCASE `--ink-3`. | — | name is heading. |
| Moderator badge | inline badge. | Mono `--fs-micro` UPPERCASE, square hairline pill, ink (no color). | display | conveyed in text, not color alone. |
| 3 stats (репутация/книг/постов) | inline. | Numbers `.display` `--fs-h2`; labels mono `--fs-micro` `--ink-3`; hairline dividers. | — | labelled groups. |
| Tab row (books/posts/communities) | `.nav-link` `data-active` + counts. | scaleX ink-underline tabs (§0); counts mono `--fs-micro`. | `setTab`; arrow-key nav. | `role="tablist"`, `aria-selected`, panels `role="tabpanel" tabindex=-1`. |
| Books tab | story cards → reader; empty "Начать книгу →". | Flat hairline story cards, grayscale `CoverSlot` hatch, `.invert-hover`. Empty = mono `--ink-3` + ghost "Начать книгу →" → compose. | `go('reader')` / `go('compose')`. | grid `<ul>`; empty `aria-live`. |
| Posts tab | `PostCard` list + load-more; empty "Постов пока нет." | PostCards (§2.4); load-more square ghost. Empty = mono `--ink-3`. | toggleReact/doRepost/removePost; `loadMore`. | feed semantics. |
| Communities tab | joined-community cards → community; empty "Найти →". | CommunityCards (§3.2, grayscale); empty = mono `--ink-3` + ghost "Найти →" → communities. | `go('community')` / `go('communities')`. | grid `<ul>`; empty `aria-live`. |
| Loading | `useFeed`/`useCommunities` loading. | Skeleton hatch tiles per tab; `aria-busy`. | — | — |

---

## 5. AUTH — `AuthModal({ open, mode, setMode, onClose, onAuth })` (L2798–2919)

| Element | BEFORE | AFTER | CONTROLS / states | A11Y |
|---|---|---|---|---|
| Overlay `.auth-overlay` | `data-open`, `backdrop-filter:blur(6px)`, fade `.35s`, `visibility` for a11y. | **Remove blur** → backdrop `rgba(0,0,0,.5)` (paper) / `rgba(255,255,255,.4)` (inverted) + optional faint static grain. reframed cuts, doesn't blur. Keep `visibility` a11y trick. | backdrop click → `onClose`. | overlay `aria-hidden` toggles with `open`; focus trapped inside card. |
| Card `.auth-card.card.framed` | scale-in `.35s`, blur card, framed. | Opaque `var(--bg)`, `1px solid var(--line-hard)`, square, **no shadow**. Entry = `scale(.985)→1` + opacity over `--t-snap` (snappier). Swiss double-frame (ink). | `onClick` stopPropagation. | `role="dialog" aria-modal="true"`, `aria-labelledby`=heading; Escape→close; **focus-trap** cycles first/last (existing L2808–2824 kept); autofocus first input after 40ms; return focus to opener on close. |
| Brand `WYRM` (W accented) | W in accent color. | Pure ink; differentiate `W` by **weight 700** vs rest 400 (no color). Display face. | — | decorative; `aria-hidden`. |
| Close `.icon-btn` (x) | abs top/right 16. | Square 36×36 hairline, `.invert-hover`, x 1.25. | `onClose`. | `aria-label="Закрыть"`. |
| Heading `.display` | "Стань соавтором"/"С возвращением". | `--fs-d4` display, tracking `-0.014em`. Subtitle `--ui` italic-retired → roman `--ink-2` `--fs-body`. | mode-dependent copy. | `<h2 id>` ties `aria-labelledby`. |
| Mode tabs ×2 (Вход/Регистрация) | `.btn.btn-sm`, accent active bg. | **Standardize as scaleX ink-underline tabs** (or square ink-fill segmented — pick underline to match nav). Active = ink underline + `--ink-max` text. | `setMode(k)`. | `role="tablist"`; `aria-selected`; arrow keys switch; form fields update accordingly. |
| Name input (reg only) | `.auth-input`, label "Имя автора". | Square hairline, mono placeholder `--ink-3`, focus ink border. Label mono `--fs-micro` UPPERCASE above. | `setName`. | `<label for>`; appears/hidden announced; focus lands here on switch to register. |
| Email input | type=email, `.auth-input`. | Same square hairline treatment. | `setEmail`. | `<label>`, `type=email`, `autocomplete=email`. |
| Password input | type=password. | Same. | `setPass`. | `autocomplete=current-password`/`new-password` by mode. |
| Submit `.btn.btn-primary` | "Минуту…"/"Создать аккаунт"/"Войти", arrow, disabled !valid/busy. | Square ink-fill, invert-to-outline hover; disabled `--ink-3`/`not-allowed`; busy = label "Минуту…" + no spinner (mono caret `▋` blink optional). Arrow 1.25. | `submit`; `valid = email.includes('@') && pass>=4 && (!reg||name)`. | `aria-disabled`; busy `aria-busy`; submit on Enter. |
| Error line `.mono` | red `oklch`. | **Ink only** (no red): mono `--fs-meta` `--ink-max`, optional `✕` glyph prefix. `aria-live="assertive"`. | conditional. | error programmatically tied via `aria-describedby` on inputs. |
| Forgot btn (login only) | `.mono.path-crumb`. | Mono `--fs-meta` ink, underline-on-hover. | `forgot()`→`store.requestPasswordReset` (PB only; demo → error msg). | focusable; result via `aria-live`. |
| Divider "или" | row. | Hairline `--rule-style` with centered mono `--fs-micro` "ИЛИ". | — | `aria-hidden`. |
| OAuth btns ×4 (VK/Yandex/Google/Apple) | `.btn.btn-ghost.btn-sm`, flex 1 0 40%. | Square ghost buttons, hairline, mono UPPERCASE labels, `.invert-hover`. **No brand colors** — monochrome wordmarks only. Equal 2×2 grid. | `social(k)`; demo → guest login; PB → `signInOAuth`. | each `aria-label`="Войти через {provider}"; keyboard reachable; OAuth popup focus returns. |
| Guest btn | `.mono.path-crumb` "Продолжить как гость →". | Mono ink underline-on-hover. | `onClose`. | focusable. |
| Closed/`!open` state | overlay hidden. | `visibility:hidden` after fade keeps tab order clean. | — | not focusable when closed. |

**Reduced-motion:** card scale-in → instant opacity; backdrop fade → instant. Focus-trap and Escape unaffected.

---

## 6. NotificationsMenu — `NotificationsMenu({ user })` (L2923–2964)

| Element | BEFORE | AFTER | CONTROLS / states | A11Y |
|---|---|---|---|---|
| Returns null if no user | — | unchanged. | — | — |
| Bell `.icon-btn` | bell icon. | Square 36×36 hairline, `.invert-hover`, bell 1.25 ink. | `setOpen(o=>!o)`. | `aria-label="Уведомления"`, `aria-haspopup="menu"`, `aria-expanded`. |
| Unread badge | accent pill count. | **Square** mono `--fs-micro` chip, ink-fill (`--ink-max` bg / `--accent-ink` text) — the count is the signal, not color. | shown when `unread>0`. | `aria-label`="{n} непрочитанных"; count in accessible name of bell. |
| Popover `.studio-pop` `data-open` | w300, right-aligned, blur. | **Remove blur**; opaque `var(--bg)`, `1px solid var(--line-hard)`, square, no shadow. Slide/fade on `--t-snap`. | outside-pointerdown closes. | `role="menu"`; arrow-key navigation; Escape closes, focus returns to bell. |
| "прочитать всё" | `.mono.path-crumb` accent. | Mono `--fs-meta` ink, underline-on-hover. | `readAll()`→`markAllNotificationsRead`+reload. | `role="menuitem"`; shown when unread>0; result `aria-live`. |
| Empty state | "Пока пусто." mono. | Mono `--fs-meta` `--ink-3`, centered. | — | `aria-live`. |
| Item rows ×≤12 | text + timeAgo, opacity .55 if read, kindIcon, unread dot. | Rows: kind icon (1.25, ink) from `kindIcon` map; text `--fs-ui-sm` `--ink` (read → `--ink-3`); time mono `--fs-micro`. **Unread dot → 6px ink square** (was colored). Hairline row separators. | display only. | each `role="menuitem"` (or listitem if non-actionable); read/unread conveyed by text-weight + square marker, not color alone. |

**Reduced-motion:** popover appears instantly.

---

## 7. AccountMenu — `AccountMenu({ user, onLogout, go })` (L2966–2992)

> Note: per shell inventory, the rendered shell uses a **burger menu**, not this dropdown, and `StudioMenu` is dead code — confirm whether `AccountMenu` is actually mounted. If mounted, restyle as below; if dead, flag for removal (don't restyle dead code).

| Element | BEFORE | AFTER | CONTROLS | A11Y |
|---|---|---|---|---|
| Trigger pill (Avatar + name) | border, radius 999. | **Square** hairline pill (radius 0), square `Avatar`, name `--fs-ui-sm` ink, `.invert-hover`. | `setOpen(o=>!o)`. | `aria-haspopup="menu"`, `aria-expanded`, `aria-label`="Аккаунт {name}". |
| Header (name + @handle) | name + mono handle. | Name `--fs-ui-sm` ink; handle mono `--fs-micro` UPPERCASE `--ink-3`. Hairline bottom rule. | display | non-focusable header. |
| Профиль (users) | `.studio-item` → profile. | `.studio-item` → square row, icon 1.25, `.invert-hover`, ink-fill on hover. | `go('profile')`+close. | `role="menuitem"`. |
| Мои ветки (quill) | → compose. | Same row treatment. | `go('compose')`+close. | `role="menuitem"`. |
| Моя версия (fork) | → cut. | Same. | `go('cut')`+close. | `role="menuitem"`. |
| Выйти (arrowL) | → onLogout. | Same; destructive but ink-only. | `onLogout()`+close. | `role="menuitem"`; focus returns to trigger after close. |
| Popover `.studio-pop` | blur dropdown. | Remove blur; opaque hairline square; `--t-snap`. Outside-pointerdown closes. | — | `role="menu"`; arrow-key nav; Escape closes. |

---

## 8. Cross-cutting for this group (apply once, affects all SOCIAL screens)

- **JSX inline edits required** (CSS can't reach): `Tag` dot (`oklch`→6px ink square), `Avatar` (circle→square), `CommunityCard`/`CommunityDetail`/`CommunityCreate` banners (`oklch` hue gradients→grayscale hatch + `mix-blend-mode:difference`), `GenreWheel` sector fill (`oklch`→`var(--ink)`+alpha), `NotificationsMenu` unread dot/badge (accent→ink square), all `--r-*`/blur/shadow inline values.
- **Unify active-state idioms** (the four flagged: `.tag.tag-btn`, `.nav-link::after`, `.plug-tab`, `.swatch-tile`): **buttons → ink-fill + `.invert-hover`**; **tabs/nav → scaleX ink underline**. Feed/Social/Profile tab rows use underline; kind chips / action bar / join buttons use ink-fill.
- **Global back control** (`.navctl-back` / `.navctl-crumb`, §5.2) is canonical on every non-Gate route (Feed, Communities, CommunityDetail, Profile). Wire `routeStack` in App. In-content crumbs (CommunityDetail "← все сообщества") demote to secondary links.
- **Reduced-motion:** all entrance/slide/invert animations collapse to instant opacity; grain freezes (no `noise`); blink cursors solid; invert-on-hover kept (instantaneous). Existing global kill-switch covers durations.
- **Empty / loading / error pattern (standardized):** empty = centered mono `--fs-meta` `--ink-3` + optional ghost CTA; loading = grayscale **diagonal-hatch skeleton tiles** (no spinners), `aria-busy`; error = mono ink line (no red, optional `✕`) in `aria-live`.
- **Keyboard/focus:** every dropdown (Notifications, Account) and modal (Auth) traps focus, closes on Escape, returns focus to opener; all tab rows are arrow-key navigable `role="tablist"`; SVG `GenreWheel` sectors made focusable buttons; disabled buttons keep accessible names and announce state.

**Files:** `/Users/bubble3/Desktop/WYRM - книга/src/app.jsx` (FeedComposer L3088, PostCard L3140, RichEditor L3261, GenreWheel L3334, Feed L3381, CommunityCard L3456, Communities L3482, CommunityCreate L3518, CommunityDetail L3583, Profile L3687, Social L3783, AuthModal L2798, NotificationsMenu L2923, AccountMenu L2966) and `/Users/bubble3/Desktop/WYRM - книга/src/styles.css` (token/selector layers per §6 of the canonical spec — edit the *later* of the two appended override blocks to win the cascade).

---


<a id="5"></a>

# Раздел 5. Экраны — Studio / Plugins / Settings / Shell

# WYRM → reframed.online — Redesign Plan: STUDIO + PLUGINS + SETTINGS + SHELL

> Token reference (from the canonical spec): `--ink #262626`, `--ink-2 #595959`, `--ink-3 #8c8c8c`, `--ink-max #000`; lines `--line`/`--line-soft`/`--line-hard`; `--bg`/`--bg-2`/`--bg-3`; motion `--ms-color 125ms ease-out`, `--t-snap .2s cubic-bezier(.55,.085,.68,.53)`; type `--fs-d1…d5`, `--fs-h1/h2`, `--fs-ui/ui-sm/meta/micro`; spacing `--sp-*`; radius 0 everywhere. Signature interactions: `.invert-hover`, `.blink ▋`, animated `noise` grain, hairline rules, square avatars, grayscale hatch covers. All canon/colored `oklch` styling is **inline in JSX** and must be edited there, not in CSS.

---

## A. APP SHELL — Header, Burger, Footer, Atmos, Global Back/Forward

### A1. `.atmos` background layer (L3889)
- **BEFORE:** Always-rendered full-bleed grain + per-theme `--hero-veil` radial glows; opacity toggled by `atmos` setting.
- **AFTER:** Keep full-bleed, always-on. Drop `--hero-veil` (→ `none`). `.atmos::after` gets the animated film-grain: `animation: noise .5s steps(4) infinite; opacity: var(--grain-opacity)` (0.05 paper / 0.07 inverted), `mix-blend-mode: overlay`. Grain rides **every** route including Gate. No colored veil.
- **CONTROLS:** none (decorative).
- **A11Y:** under `prefers-reduced-motion: reduce` → freeze `noise` (static grain, no `transform` animation), keep grain visible.

### A2. Header `.nav.wrap.topbar` (L3893–3906)
- **BEFORE:** Sticky 12px-blur glass bar, `min(100%-48px,maxw)`; `.brand` logo `W`(accent)`YRM` + `студия` tld; right cluster = NotificationsMenu + burger.
- **AFTER:** De-glass → flat `var(--bg)` bar with a single `--rule-style` bottom hairline (or transparent over Gate, where header is absent anyway). Height tightens to `--sp-7` (48px) content band. Logo `WYRM` in `--display`, `--fs-h2`, letter-spacing `-0.011em`: the `.w` loses accent color → pure `--ink-max`; sole differentiator = `W` weight 700, `YRM` weight 400. `.tld студия` → `.mono --fs-meta` uppercase `--ink-3`, `+0.08em`, preceded by a hairline `·`. Brand is `.invert-hover`.
- **CONTROLS:**
  - **Brand → `go('landing')`:** `.invert-hover`; focus-visible = 2px `--ink-max` outline offset 2px.
  - **Burger `.icon-btn.nav-burger`:** 36×36 square, `1px solid var(--line)`, icon stroke 1.25, `menu`↔`x`. Hover = invert-on-hover; `aria-expanded` preserved.
- **A11Y:** `aria-expanded` on burger kept; brand and burger reachable in tab order; outline never removed, only restyled.

### A3. **NEW — Global nav control `.navctl` (fixes the no-history gap)** (§5.2)
- **BEFORE:** No back/forward affordance anywhere except brand→landing and mobile-menu "Ворота". `go()` has no history stack.
- **AFTER:** Fixed **top-left** cluster on every non-Gate route, mirroring the burger top-right. Two parts on one baseline:
  - `.navctl-back` — `.btn`-style hairline button, label `← НАЗАД` in `.mono` uppercase `--fs-meta`, square, `1px solid var(--line-hard)`, padding `6px 12px`, `.invert-hover`.
  - `.navctl-crumb` — `.mono --fs-meta` `WYRM · <route label>`; the `WYRM` token is `.invert-hover` → `go('landing')`.
- **JS:** add `routeStack` array to App; every `go()` pushes the prior route; back pops it. When stack empty → label flips to `← ВОРОТА`, returns to `landing`. Forward intentionally omitted (no forward stack). `ctx` should be reset/scoped on back to avoid stale-payload leak (documented gap).
- **CONTROLS:** Back button hover = invert; active = 1px inset shift (no scale); disabled state never (empty stack = `← ВОРОТА` instead). The per-screen ad-hoc crumbs (Merge `← древо`, CommunityDetail `← все сообщества`, LoreGraph/Stakes/Room/Cut none) are demoted to optional secondary in-content links; `.navctl-back` is canonical.
- **A11Y:** `.navctl-back` is a real `<button>` with `aria-label` reflecting target (`Назад к <label>` / `К воротам`); appears at a consistent DOM position so screen-reader users get the same back control on every screen. Reduced-motion: invert stays (instantaneous opacity), route-flash disabled.

### A4. Mobile menu `.mobile-menu` / `.mobile-menu-panel` (L3909–3936)
- **BEFORE:** Right slide-out drawer, 2px backdrop blur; `.mobile-link` rows `data-active`; sections Ворота/NAV/Студия/Ещё/Auth; "Сменить мир" toggles night↔manuscript inline.
- **AFTER:** Hard-edged opaque panel (`var(--bg)`), **no blur** → backdrop `rgba(0,0,0,.5)` (paper) / `rgba(255,255,255,.4)` (inverted), optional faint static grain. Full-height **left hairline rule** (`--rule-hard`) on the panel edge. `.mobile-link` rows: square, `--fs-ui`, mono-label section headers `.mobile-menu-label` in `.eyebrow` style (`+0.2em` uppercase `--ink-3`); each link `.invert-hover`; `data-active` → ink-fill (`background:var(--ink-max); color:var(--accent-ink)`). Icons stroke 1.25.
  - "Сменить мир" relabels the toggle target from `night/manuscript` → `paper/inverted`; icon `sun`/`moon` retained.
  - Auth block primary "Войти" = `.btn-primary` inked.
- **CONTROLS:** every `.mobile-link` invert-on-hover; active = ink-fill; backdrop click closes; panel stops propagation. Enter/Space activate.
- **A11Y:** focus trap inside panel while open; Escape closes (add if absent); `data-open` drives `visibility` for tab-order exclusion when closed; reduced-motion → slide collapses to instant.

### A5. Footer (L3960–3966, shown when `!landing && !studioRoute`)
- **BEFORE:** Brand + mono tagline + world label `мир · Ночь`/`Манускрипт`.
- **AFTER:** Top `--rule-hard` divider, generous `clamp(var(--sp-8),9vw,var(--sp-11))` top padding. Brand in `--display`; tagline `.mono --fs-meta`; world label → `мир · Бумага`/`мир · Инверсия`. End the tagline with a `<span class="blink">▋</span>` for the terminal-lab beat. Flat, no shadow.
- **A11Y:** blink disabled under reduced-motion (solid block).

### A6. Modals mounted at shell (AuthModal, PluginHost, SettingsDrawer, NotificationsMenu)
Covered individually below (D, B, C). Shell-level note: **all `backdrop-filter:blur` removed** across `.auth-overlay`, SettingsDrawer backdrop, `.studio-pop`, `.mobile-menu` — reframed cuts, never blurs.

---

## B. STUDIO — Shared Shell + StudioMenu + the 5 Mechanics

### B0. Shared studio shell (all 5)
- **BEFORE:** `.view.wrap`, `.eyebrow` "Механика NN · …", a `.reader-grid` (`minmax(0,1fr) {320|340}px`) with sticky `top:84` aside. Rail widths mixed 320/340. Only Merge has a back affordance.
- **AFTER:** Same skeleton, restyled. **Rail width unified to 340px** everywhere. `.eyebrow` → `.mono +0.2em` uppercase `--ink-3`, `--fs-meta`, ending in a `<span class="blink">▋</span>`. `.reader-grid` collapse breakpoint retargeted **940px → 800px**. Section vertical rhythm uses `--sp-*`; cards become hairline rectangles (radius 0, `1px solid var(--line)`, no blur/shadow). The global `.navctl-back` (A3) now gives all five a consistent back — per-screen crumbs become secondary. `.view` gets `viewIn` entrance (translateY 8px + fade, `.32s var(--ease)`).
- **A11Y:** sticky aside reachable in source order; reduced-motion disables `viewIn`.

### B1. StudioMenu (L4075–4098) — *defined but not mounted*
- **BEFORE:** Dead-code dropdown (`.nav-link` trigger + `.studio-pop` panel of `.studio-item`); not rendered in shell (burger-only nav).
- **AFTER:** Recommendation: **leave unmounted / delete** to avoid two nav idioms. If ever revived, restyle to match the unified `.studio-pop` (hard-edged, hairline, `.studio-item` rows with scaleX-ink-underline active + invert-on-hover) per D-menus. Flag as removable dead code.
- **A11Y:** n/a while unmounted.

### B2. Merge — `Merge({go})` + `MergeHunk` (L1508–1722)
- **BEFORE:** PR-style diff merger; status pill (green/orange), story+source+target `<select>`s, hunk add/del/conflict lines in `oklch` green/orange, reviewer toggles green-bordered, `← древо` crumb.
- **AFTER:**
  - **Back row:** `← древо` demoted to secondary `.mono path-crumb` (hairline, invert-on-hover); canonical back = `.navctl-back`.
  - **PR header `.card.framed`:** Swiss double-frame (outer hairline + 4px inset hairline, pure ink — replaces manuscript gilt). Title `«Слияние ветви в канон»` in `--display --fs-d4`, `-0.014em`. **Status pill** → StatusPill idiom: no color; `● готово` = ink dot + `ГОТОВО К СЛИЯНИЮ` mono `--fs-micro` uppercase on `--bg-3`+`1px solid var(--line)`; `нужно ревью` = `?`/outline glyph. `<select>`s → square, `1px solid var(--line)`, `--ink`, mono, focus border→`--ink-max`.
  - **MergeHunk:** drop all green/orange `oklch`.
    - `ctx`: `.serif-italic`→`--ui` italic, `--ink-3`, dimmed.
    - `add`/`del`: distinguished by **glyph + position + weight**, not hue — `+`/`−` mono prefix in `--ink-max`; accepted = full ink; rejected `add` = strikethrough + `opacity:.45`. Right toggle `отклонить/вернуть` = `.mono` invert-on-hover.
    - `conflict`: bordered block `1px solid var(--line-hard)`, header `⚠ конфликт · hunk #id` mono uppercase; the two choice `<button>`s (`текущий канон` / `@grimwarden`) are full-width hairline, selected = ink-fill + `check`.
  - **Review rail:** 3 checks as mono rows with `●`/`✕` glyphs; **reviewer toggles** lose green border → `data-on` = ink-fill, invert-on-hover. Merge button `.btn-primary` (inked) "Слить в канон"/"Заверши ревью"; disabled = `--ink-3` text, `--bg-3`, `cursor:not-allowed`. Success card "Слияние записано" → "К древу" `.btn`.
- **CONTROLS / nav:** exit = `.navctl-back` or success "К древу" → `go('reader',{story,node:targetId})`. All toggles invert-on-hover; disabled merge button non-interactive + `aria-disabled`.
- **A11Y:** selects have labels; conflict choice buttons are radio-semantics (`aria-pressed`); reduced-motion keeps instant inverts; focus-visible 2px ink outline.

### B3. LoreGraph — `LoreGraph({go})` (L1733–1944)
- **BEFORE:** Radial character graph colored by `CHAR_STATUS` hue; consistency checker with severity-colored left borders (high/mid hue); story switcher; no back.
- **AFTER:**
  - **Header:** title `Кодекс «{story}»` `--display --fs-d3`. Story-switcher pill group → square segmented buttons, hairline, active = ink-fill, invert-on-hover.
  - **Graph `.tree-scroll`:** radial-gradient bg → flat `var(--bg-2)` with optional faint hatch. Co-appearance `<line>`s: idle `--line` 1px, active `--ink-max` 1.5px (was accent); relation `<text>` labels in `.mono --fs-micro`. Character `<button>`s: square glyph **Avatar** (radius 0, `1px solid var(--line)`), name, `<StatusPill>` (now glyph-based, see D-StatusPill). **Node color = status** is replaced by **status glyph in the pill**, not node hue; selected node = `2px solid var(--ink-max)` + 2px inset frame.
  - **Legend:** maps `CHAR_STATUS` to **glyphs** (`● ✕ ? ≠`) not colors; caption "цвет узла = статус" → "знак узла = статус".
  - **Issue cards:** severity colored left border → **rule weight**: high = `--line-hard` 3px left, mid = 2px, low = 1px (all ink); severity also shown by a mono tag `ВЫСОКАЯ/СРЕДН/НИЗК`. "Развести линии" = `.btn-sm` (hairline), "Игнор" = `.btn-ghost.btn-sm` (underline-on-hover).
- **CONTROLS / nav:** exit via `.navctl-back` or appearance/issue buttons → `go('reader',…)`. "показать скрытые (N)/скрыть" = `.mono path-crumb` invert-on-hover. Empty state (no characters): `eye` icon stroke 1.25 + mono prompt, `--ink-3`.
- **A11Y:** SVG graph nodes are real `<button>`s with `aria-label` (name + status); legend text-based so not color-only; reduced-motion: no node motion.

### B4. Stakes — `Stakes({go})` (L1953–2130)
- **BEFORE:** Reputation-allocation economy; leading candidate gets gold border + `--canon-glow`; two range sliders; royalty stacked color bar; budget number turns orange when low.
- **AFTER:**
  - **Election `.card.framed`:** Swiss double-frame. Candidate cards: leader distinguished by **`2px solid var(--ink-max)` + filled `★` marker**, not gold/glow (`--canon-glow:none`). "ЛИДЕР" mono tag. Live `pct%`+points in `--display`. Progress bar = `--ink-max` fill on `--line-soft` track.
  - **Range sliders:** square track `var(--line)`, square `12×12 var(--ink-max)` thumb; readout `+N очк.` mono. Clamp logic unchanged.
  - **Royalty `.card`:** stacked `%` bar → grayscale segments differentiated by **alpha steps** (0.95/0.75/0.55/0.35/0.18 of `--ink`) + hairline separators, not hue; author rows: square Avatar, `@handle`, mono weight%.
  - **Budget card:** big `left/BUDGET` `--display`; low-budget orange → **`--ink-max` + a mono `⚠ мало` flag** (no color). Commit button `.btn-primary` "Поставить {spent} очков"; disabled when `spent===0`. Committed box → "ещё" `.mono path-crumb` reset.
- **CONTROLS / nav:** no outbound nav originally — add `.navctl-back` as the exit. Sliders keyboard-operable; commit disabled state `aria-disabled`.
- **A11Y:** `<input type=range>` keep native a11y + `aria-valuetext` = "+N очков"; leader status conveyed by `★`+tag, not color alone; reduced-motion: bar `width` transition kept (informational, short) but no decorative motion.

### B5. WritersRoom — `WritersRoom({go})` (L2139–2331)
- **BEFORE:** Live relay; "В ЭФИРЕ" red-dot badge / gray "демо-режим"; living-manuscript card with turn timer (red <10s), `.caret` blink on server buffer; reaction flame/star; direction vote bars with accent leader; queue list.
- **AFTER:**
  - **Loading state:** "подключение к комнате…" centered, `.mono --ink-3`, with a `<span class="blink">▋</span>`.
  - **Live badge `.live-badge`:** colored pulsing dot → **black blinking square** (`.blink ▋` / `pulse` dropped). "В ЭФИРЕ" mono uppercase. "демо-режим" = `--ink-3` mono (tooltip kept).
  - **Living manuscript `.card.framed`:** Swiss frame. Timer text: `<10s` red → `--ink-max` **700 weight + blink** instead of color. History paragraphs `--ui`, attribution `— @who` mono `--ink-3`. When I hold the pen → `.compose-input` (square, hairline, focus→ink). Else server `buffer` ends with blinking `.caret` (kept). Reaction buttons (flame "уголёк" / star "канон") → hairline `.tag-btn`, invert-on-hover, count mono.
  - **Direction card:** vote bars → `--ink-max` fill on `--line-soft`; leader accent → leader marked by **filled marker + weight**; "твой голос" = `check` glyph. Add-direction input square + "Добавить" `.btn-sm`; Enter submits.
  - **Queue rail:** holder dot → ink square; "пишет сейчас/следующий/в очереди" mono labels; join/leave button `.btn` invert-on-hover.
- **CONTROLS / nav:** no outbound nav — exit = `.navctl-back`; realtime cleanup on unmount preserved. All reaction/vote/queue buttons invert-on-hover; vote locked-after-first state shown by `check`, not color.
- **A11Y:** live region (`aria-live="polite"`) on buffer/history for screen readers; blink + caret disabled under reduced-motion (solid); timer urgency announced textually, not color-only.

### B6. ReadersCut — `ReadersCut({go})` (L2348–2505)
- **BEFORE:** Personal-canon walker; vertical gold→accent gradient spine; numbered node circles (gold if canon, accent else); fork choice tag-buttons; export download/share.
- **AFTER:**
  - **Mood presets row:** 4 `.tag.tag-btn` (Канон/Хоррор/Романтика/Светлый побег) → square, mono uppercase, active = ink-fill, invert-on-hover.
  - **Spine:** gradient line → **solid `--line-hard` hairline** (1px). Node circles → **squares**: canon = `2px solid var(--ink-max)` + filled `★`; alt = `1px solid var(--line)`. Number in `.mono`. Each `.card` (title, канон/альт mono tag, `@author·N слов`, excerpt) is a hairline rectangle. Fork rows: `.tag.tag-btn` choices, `data-active` = ink-fill. Ends with `flame` icon (stroke 1.25) + "Конец твоей версии."
  - **Rail:** "Твоя версия" stats card; deviation bar `divPct%` red-if->50 → **`--ink-max` fill + mono `⚠` flag** when high (no red). Export card: "Скачать эл. книгой" `.btn-primary`, "Поделиться версией" `.btn-ghost` (underline-on-hover). Exported box → "назад" `.mono path-crumb`.
- **CONTROLS / nav:** no outbound nav — exit `.navctl-back`; "назад" only resets `exported`. Download triggers Blob `<a>`; share copies link.
- **A11Y:** preset/fork buttons `aria-pressed`; canon vs alt conveyed by `★`+tag not color; export buttons have descriptive labels; reduced-motion: spine static.

---

## C. SettingsDrawer (L3977–4073) + Field + ACCENTS/FONTS

### C0. Drawer chrome
- **BEFORE:** Right-fixed `min(380px,92vw)`, blurred backdrop, slide via translateX; header eyebrow "Кастомизация" + h2 "Настройки мира" + close.
- **AFTER:** Slide-from-right kept; **blur removed** → backdrop `rgba(0,0,0,.5)`/`rgba(255,255,255,.4)` + optional faint grain. Hard-edged opaque panel (`var(--bg)`) with a **full-height left hairline rule** (`--rule-hard`). Header h2 `--display --fs-d4`; eyebrow `.eyebrow`. Close `.icon-btn` square, invert-on-hover.
- **A11Y:** focus trap + Escape close; backdrop click closes; reduced-motion → instant slide.

### C1. Field "Мир оформления" (item 1)
- **BEFORE:** Two `.swatch-tile` `['night','Ночь','moon'], ['manuscript','Манускрипт','sun']` → `setTheme`.
- **AFTER:** **Rename tiles → `['paper','Бумага','sun','Чёрным по белому'], ['inverted','Инверсия','moon','Белым по чёрному']`.** `setTheme` writes `data-theme="paper|inverted"`; default `paper`. `.swatch-tile` square, hairline, `data-active` = ink-fill + scaleX-ink-underline; invert-on-hover. Hint updated to "Один свет — две стороны, не цвет".
- **A11Y:** `aria-pressed` on tiles; labels readable.

### C2. **Field "Акцентный цвет" (item 2) — REMOVED** + `ACCENTS` deleted (L3811–3817)
- **BEFORE:** 5 round `oklch` swatches (theme/jade/ember/indigo/gold), active double-ring → `setAccent`.
- **AFTER:** **Entire Field deleted.** `ACCENTS` array removed. Config-apply effect stops writing `--accent`/`--gold` (they resolve to `--ink-max` via cascade). This is the single biggest semantic change — surface to user as deliberate. `setAccent` and its state removed.
- **A11Y:** n/a (removed); one fewer control to navigate.

### C3. Field "Шрифт заголовков" (item 3) + `FONTS` (L3818–3822)
- **BEFORE:** 3 `.swatch-tile` (Onest/Lora/JetBrains) sample "Wy" → `setFont`.
- **AFTER:** Two options:
  - **Recommended:** **remove the picker entirely** — a monochrome system implies one display face (Space Grotesk). Drop the Field.
  - **If retained:** replace `FONTS` with in-language display options `['grotesk','Space Grotesk'], ['archivo','Archivo'], ['mono','JetBrains']`; tiles square, hairline, sample "Wy" in `--display`, active = ink-fill. Config-apply keeps `--display` swap.
- **A11Y:** `aria-pressed`; sample text has `aria-hidden`, mono label is the accessible name.

### C4. Field "Масштаб интерфейса" (item 4)
- **BEFORE:** `<input type=range min85 max120 step5>` `.range`, hint `{scale}%`.
- **AFTER:** `.range` square track `var(--line)`, square `12×12 var(--ink-max)` thumb, focus border→ink. Hint `{scale}%` in `.mono`. Config-apply keeps root `font-size = 16*scale/100`.
- **A11Y:** native range + `aria-valuetext="{scale}%"`.

### C5. Field "Атмосфера" (item 5)
- **BEFORE:** `.toggle` `data-on={atmos}` + knob, "Включена"/"Выключена".
- **AFTER:** `.toggle` square track `1px solid var(--line)`; `data-on` → `background:var(--ink-max)`, knob (`--accent-ink`) slides; no color. Label mono. (Atmos now also drives the animated `noise` grain presence.)
- **A11Y:** `role="switch"` + `aria-checked`; reduced-motion → instant knob.

### C6. Field "Расширения сообщества" (item 6)
- **BEFORE:** Quick list of 5 plugin rows (glyph tile accent-colored if on, name, @author, non-interactive `.toggle` indicator) + "Магазин и конструктор расширений" ghost button → plugins.
- **AFTER:** Rows: square glyph tile (`1px solid var(--line)`, glyph `--ink-max` when on, `--ink-3` when off — **no accent color**), name `--fs-ui`, `@author` mono `--ink-3`, `.toggle` indicator square. Row button invert-on-hover. Store button `.btn-ghost.btn-sm` underline-on-hover → `openStore` → `go('plugins')`.
- **A11Y:** each row `aria-pressed` reflecting on/off; toggle indicator `aria-hidden` (state already on row).

### C7. Field primitive (L4100–4110)
- **BEFORE:** `.mono` label + optional dimmed `.mono` hint on a baseline row, children below.
- **AFTER:** Label → `.eyebrow` (`+0.2em` uppercase `--ink-3`); hint → `.mono --fs-meta --ink-3` right-aligned; gap label→content `--sp-2`. Pure layout, no interactivity.
- **A11Y:** label associated with control group via `aria-labelledby` where applicable.

### C8. Closing note (item 7)
- **BEFORE:** Mono "Настройки сохраняются на этом устройстве…".
- **AFTER:** `.mono --fs-micro --ink-3`, unchanged copy; optional trailing `▋`.

---

## D. PLUGINS — PluginsScreen, FX overlays, shared primitives used here

### D1. PluginsScreen — header/tabs (L2629–2786)
- **BEFORE:** 3 `.plug-tab` `data-active` (Магазин/Включённые/Создать своё) with mono count badges.
- **AFTER:** PageHead-style header (`--display`). Tabs → **scaleX ink-underline** active idiom (the unified tab pattern, §5.7) + invert-on-hover; count badge `.mono --fs-meta` square chip `1px solid var(--line)` (no accent pill). Tab band sits on a `--rule-style` bottom hairline.
- **A11Y:** `role="tablist"`/`tab`/`tabpanel`, `aria-selected`; arrow-key tab nav.

### D2. Build tab (`tab==='build'`) — `.compose-grid` form
- **BEFORE:** name input `.compose-input.display`; 6 category `.tag.tag-btn` (hue dot); 3 slot `.swatch-tile`; 8 glyph `.swatch-tile`; 4 `oklch` color swatches; publish `.btn-primary` + `Icon bolt`; live-preview aside.
- **AFTER:**
  - **Name input:** square `.compose-input.display`, hairline, focus→ink, mono placeholder `--ink-3`.
  - **Category buttons:** square `.tag.tag-btn`, `.dot` → **6px solid ink square** (drop `PLUGIN_CATS` hue), active = ink-fill, invert-on-hover.
  - **Slot tiles / Glyph tiles:** `.swatch-tile` square, hairline, glyph `--ink-max`, active = ink-fill + scaleX underline.
  - **Color swatches (`PLUGIN_COLORS`):** **Decision — remove the color picker** (monochrome system has no plugin accent color); custom plugins render ink. If a vestige is desired, keep as grayscale alpha tiles, but recommended: delete `bColor`/`PLUGIN_COLORS` and the swatch row, and drop `p.color` usage in render.
  - **Publish:** `.btn-primary` inked, `Icon bolt` stroke 1.25 → invert to outline on hover.
  - **Live preview aside `.card.framed`:** Swiss frame; glyph tile + name + `@ты·{cat}·{slot}` mono meta; the 64px slot-demo box renders topbar-stripe / `.plug-chip` / fab in **ink** (was `bColor`). Caption "так это видят читатели" mono.
- **A11Y:** each builder group labeled via `<Field>`; swatch tiles `aria-pressed`; preview `aria-hidden` (decorative mirror).

### D3. Store / Installed tabs (else branch)
- **BEFORE:** "Все" + 6 category `.tag.tag-btn` (hue dots) filters; plugin cards `.reveal.card` (borderColor accent if on); glyph tile (cat hue / p.color); "ТВОЁ" badge; toggle "Вкл/Выкл" `.toggle`+knob; meta `★rating·installs`; installed-empty `.serif-italic`.
- **AFTER:**
  - **Filters:** square `.tag.tag-btn`, ink-square dot, active = ink-fill, invert-on-hover; "Все" `data-active={!cat}`.
  - **Cards:** hairline rectangles, no blur/shadow; "on" state → border darken to `--ink-max` (not accent). Glyph tile = `1px solid var(--line)`, glyph `--ink-max` if on / `--ink-3` if off. "ТВОЁ" badge `.mono --fs-micro` square chip. **Toggle "Вкл/Выкл"** `.toggle` square, `data-on` = ink-fill, knob slides. Meta `★ {rating} · {installs}` mono `--ink-3` (the `★` is a glyph, not gold).
  - **Empty state (installed):** `.serif-italic`→`--ui` italic, `--ink-3`, "Пока ничего не включено…".
- **A11Y:** toggle `role="switch"`+`aria-checked`; filters `aria-pressed`; card grid keyboard-traversable; "on" state not color-only (border-weight + toggle state).

### D4. FX overlays — `PluginHost` + children (L2540–2619)
- **Embers (`bg`):** colored `✦` drift → **monochrome `✦` in `--ink` at low opacity**, drift animation kept; `aria-hidden`. Reduced-motion: freeze.
- **ReadingProgress (`topbar`):** glowing accent bar → flat `--ink-max` fill on transparent track, **no glow**; width = scroll%. Reduced-motion irrelevant (scroll-driven).
- **DiceFab (`fab-r`):** `.plug-fab` square (radius 0), `1px solid var(--line-hard)`, `--ink-max` glyph `⚄`, invert-on-hover; 360° spin on click kept (`--t-snap`). Reduced-motion: no spin (instant glyph swap).
- **WordHud (`fab-l`):** `.plug-hud` de-glassed (no blur), flat `var(--bg)` + hairline; mono label + `--display` `k` number, ink.
- **ChipTray (`chip`):** `.plug-chip` square, hairline, `p.color` borderColor → **ink** (drop color); glyph + mono name; non-interactive.
- **Custom topbars/fabs:** `b.color||var(--accent)` background → `var(--ink-max)`; custom `fab-r` currently has **no onClick (dead interaction)** — flag for fix or removal.
- **PluginHost class-slot (zen):** keeps toggling `body.zen`; zen mode in the monochrome system dims chrome as before (now de-glassed).
- **A11Y:** all FX `aria-hidden="true"`; ReadingProgress non-focusable; DiceFab is a real button with `title`/`aria-label` "Бросок развилки"; reduced-motion freezes embers + spin.

---

## E. Cross-cutting primitives consumed by this group (restyle once, applies everywhere)

| Primitive | BEFORE | AFTER | A11Y |
|---|---|---|---|
| **`.btn`** | display font, radius 10, accent fill | square, `1px solid var(--line-hard)`, `--fs-ui-sm`, invert-on-hover over `--ms-color`; active = 1px inset shift | focus-visible 2px ink outline |
| **`.btn-primary`** | accent fill | inked (`bg:--ink-max`, `color:--accent-ink`); hover inverts to outline | `aria-disabled` when off |
| **`.btn-ghost`** | accent text | `--ink-2` text, underline-on-hover via `::after` scaleX | — |
| **`.btn-sm`** | small accent | `--fs-meta`, `6px 12px` | — |
| **`.icon-btn`** | 36×36 radius 10 | 36×36 square, `1px solid var(--line)`, stroke-1.25 icon, invert-on-hover | label/`title` required |
| **`.tag`/`.tag-btn`/`.dot`** | 999px pill, colored hue dot | square, hairline, dot→6px ink square, active=ink-fill, `.tag-btn` invert-on-hover | `aria-pressed` |
| **`.toggle`/`.toggle-knob`** | colored on-state | square track hairline, `data-on`=ink-fill, knob slides | `role="switch"` |
| **`.range`+thumbs** | accent thumb | square `12×12` ink thumb, square track `--line`, focus→ink | `aria-valuetext` |
| **`.swatch-tile`** | active double-ring | square, active=ink-fill + scaleX underline, invert-on-hover | `aria-pressed` |
| **`.studio-pop`/`.studio-item`** | blurred popover | de-glassed opaque + hairline; items scaleX-underline active + invert-on-hover | outside-pointerdown close kept; Escape close |
| **`.nav-link`/`.plug-tab` active** | divergent idioms | unified **scaleX ink underline** for tabs/nav | `aria-selected` |
| **`Avatar`** | round monogram | **square**, radius 0, `1px solid var(--line)`, mono initial, `--bg-3` | `aria-hidden` decorative / name as label |
| **`StatusPill`/`CHAR_STATUS`** | `oklch(hue)` pill | ink on `--bg-3`+hairline; differentiate by **glyph+label** (`●`/`✕`/`?`/`≠`) mono `--fs-micro` uppercase | not color-only |
| **`CanonMeter`** | gold/accent split fill | always `--ink-max` fill on `--line-soft`; canon shown by label weight + `★`/`КАНОН` tag; `transition:width 1s` kept | — |
| **`.caret`/`.live-badge`** | colored pulse dot | caret blink kept; live dot → **black blinking square**; pulse dropped | blink off under reduced-motion |
| **`.card`/`.card.framed`** | blur+shadow / gilt double-rule | flat hairline rect (radius 0, no blur/shadow); framed = pure-ink Swiss double-frame (outer + 4px inset) | — |
| **`::selection`** (declared twice) | accent bg | collapse to one: `background:--ink-max; color:--accent-ink` | — |
| **Scrollbars** | default | thumb `--line-hard`, transparent track, square | — |
| **Icons** | stroke 1.6 | stroke **1.25**, monochrome `currentColor`, inherit invert-on-hover | `aria-hidden` |

---

## F. Motion & reduced-motion summary for this group
- Hover (buttons, tags, nav corners, studio items, plugin cards, toggles): `.invert-hover` opacity over `--ms-color ease-out`; color/bg/border transitions `125ms`.
- Transforms/size (fab spin, knob slide, modal entry `scale(.985)→1`, view-in): `--t-snap (.2s easeIn)`.
- Grain `noise` animation on `.atmos::after`; `.blink ▋` on live badge / eyebrows / loading / footer; `.caret` on Room buffer.
- Optional `.route-flash` 1-frame invert on `go()` (gate behind reduced-motion).
- **`prefers-reduced-motion: reduce`:** global durations →`.001ms`; additionally freeze `noise` (static grain), disable `blink`/`caret` (solid), disable route-flash and any spin/parallax; invert-on-hover stays (instantaneous, non-animated opacity).

---

## G. JS touch-points required for this group (src/app.jsx)
1. **Delete `ACCENTS` (L3811–3817)** + remove SettingsDrawer "Акцентный цвет" Field + `setAccent` state.
2. **`FONTS` (L3818–3822):** replace with in-language display options or remove the picker Field.
3. **Theme tiles:** `night/manuscript` → `paper/inverted`; `setTheme` writes `data-theme="paper|inverted"`; default `paper`.
4. **Config-apply effect (L3862–3871):** stop writing `--accent`/`--gold`; keep `--display` + `font-size` scale; write `data-theme`.
5. **Add `routeStack` + back handler** to App powering `.navctl-back` (fills the no-history gap); reset/scope `ctx` on back to prevent stale-payload leak.
6. **Mount `.navctl`** on every non-Gate route (top-left), burger stays top-right.
7. **StudioMenu:** leave unmounted (recommend delete as dead code).
8. **Plugin builder:** remove `bColor`/`PLUGIN_COLORS` + color-swatch row; drop `PLUGIN_CATS` hue dots; drop `p.color` in `ChipTray`/custom topbar/fab render.
9. **Custom `fab-r` dead onClick:** wire an action or remove the affordance.
10. **Inline `oklch()` in StatusPill / CanonMeter / Avatar / category dots / FX overlays** must be edited in JSX to neutral values (CSS-only won't reach them).

---

Files referenced: `/Users/bubble3/Desktop/WYRM - книга/src/app.jsx` (all studio/plugins/settings/shell components + JS touch-points §G), `/Users/bubble3/Desktop/WYRM - книга/src/styles.css` (primitive restyles §E, tokens, motion §F).

---


<a id="6"></a>

# Раздел 6. Дорожная карта внедрения, решения, риски

# WYRM → reframed.online — Implementation Roadmap

> Executes the monochrome brutalist-editorial redesign across `src/app.jsx` (4137 lines, single file), `src/styles.css` (1519 lines), `src/lib/*`, `pb_migrations`/`pb_hooks`, and `realtime/`. The plan is **incremental and always-runnable**: every phase ships a coherent, deployable state. Token names (`--accent`/`--gold`) survive as ink aliases so the app keeps compiling between phases.

---

## 0. Guiding principles

1. **Token-first, cascade-aware.** All color/shape/space lives in `:root` + `[data-theme]`. Because `styles.css` has **two appended override layers** (Malvah polish L1165+, Gate/intro/workspace L1204+), every selector edit must target the **later** declaration to win the cascade.
2. **Compat aliases never break the build.** `--accent`/`--gold` are re-pointed to `--ink-max`, not deleted — class-styled components keep working untouched. Only **inline `oklch()`/hue** in JSX components (`Tag`, `Avatar`, `CoverSlot`, `StatusPill`, `CanonMeter`, `GenreWheel`, `MiniTree`, `StoryTree`, banners) need hand edits.
3. **Always green.** After each phase the app builds, runs, and passes existing tests. No phase leaves a half-migrated theme.
4. **Reduced-motion is a first-class exit criterion**, not a final-phase afterthought.

---

## 1. PHASES

### P0 — Design tokens + fonts (foundation)
**Files:** `src/styles.css` (L1–763 font-face, L767–839 tokens, L1168 radius).

- Replace the two `[data-theme]` bodies: delete `night`/`manuscript` token blocks → add `:root`/`[data-theme="paper"]` (§1.2) and `[data-theme="inverted"]` (§1.3).
- Re-point `--accent`/`--accent-default`/`--gold`/`--gold-default` → `var(--ink-max)`; add `--ink`/`--ink-2`/`--ink-3`/`--ink-max`, `--line`/`--line-soft`/`--line-hard`.
- Add full token systems that don't exist today: `--sp-0…11` spacing, `--fs-d1…d5`/`--fs-h1…h3`/`--fs-ui*`/`--fs-meta`/`--fs-micro` type scale, `--ms-color`/`--ease-color`/`--ease-snap`/`--t-snap` motion, `--invert-amt`, `--r-card/btn/pill/input: 0`.
- Set `--node-glow`/`--canon-glow`/`--hero-veil`/`--shadow-card: none`.
- **Font-face surgery:** drop all Onest + all Lora weights; add Space Grotesk (400/500/700) + Inter (400/500/700) self-hosted woff2; keep JetBrains Mono. Update `--display`/`--ui`/`--serif`(→`var(--ui)`)/`--mono` (§2.2). `body { font-family: var(--ui); line-height: 1.5 }`.

**Exit:** App loads in `paper` theme; no colored accents anywhere even though components are unstyled-for-mono; no missing-font FOUT; bundle has no Onest/Lora.
**Effort: M** (font self-hosting + token authoring; mechanically simple, high blast radius).

---

### P1 — Shell + Nav + Gate + global back history
**Files:** `src/app.jsx` (App L3831–3958, Gate L770–882, mobile menu L3909–3936, footer L3960–3966, config-apply L3862–3871); `src/styles.css` (`.nav`/`.topbar`/`.atmos`/`.mobile-menu`/`.gate-*`).

- **`routeStack` + History API:** add `routeStack` array to App; `go()` pushes prior route + does `history.pushState`; add `popstate` handler; **reset/scope `ctx` on back** (fixes documented stale-payload leak). Reload no longer dumps to `landing`.
- **`.navctl` global back control** (§5.2): fixed top-left `[← НАЗАД] · WYRM / <route>` on every non-Gate route; empty stack → `← ВОРОТА`. Real `<button>`, first in tab order.
- **Header de-glass:** flat `var(--bg)` + hairline bottom rule; `.w` → ink, weight-700 differentiator only; burger square 36×36.
- **Theme map rename:** SettingsDrawer/mobile tiles `night/manuscript` → `paper/inverted`; `setTheme` writes `data-theme="paper|inverted"`; default `paper`. Config-apply stops writing `--accent`/`--gold`; keeps `--display` + font-size scale.
- **Mobile menu:** remove blur, hard panel + left hairline rule, ink-fill active, focus-trap + Escape.
- **Gate:** align `--g-bg`/`--g-ink`; keep blur→sharp wordmark, parallax, lab geometry; wordmark → Space Grotesk d1; corners get `.invert-hover`. Animated grain deferred to P7.
- **Footer:** world label → `Бумага`/`Инверсия`.

**Exit:** Every screen has a working back button; reload preserves route; theme toggle flips paper/inverted; no header glass; Gate fully on-brand. `ctx` no longer leaks across stories.
**Effort: L** (history wiring + ctx reset is the riskiest single change; touches every navigation call site).

---

### P2 — Shared primitives
**Files:** `src/app.jsx` (`Icon`, `Tag`, `Avatar`, `CanonMeter`, `CoverSlot`, `StatusPill` + `CHAR_STATUS`); `src/styles.css` (`.btn*`, `.tag*`, `.icon-btn`, `.toggle`, `.range`, `.swatch-tile`, `.card*`, `.studio-pop`, `::selection`, scrollbars, `.nav-link`).

- **Add utility classes:** `.invert-hover` (+`::after`), `.blink`/`@keyframes blink`, `@keyframes noise`, `.rule`/`.rule-hard`.
- **Buttons/tags/inputs** → square, hairline/ink-fill, invert-on-hover (§5.1, §5.4, §5.7). Unify the four active-state idioms → **ink-fill+invert for buttons, scaleX ink underline for tabs/nav**.
- **JSX inline edits (CSS can't reach):** `Tag` dot → 6px ink square; `Avatar` → square, `1px solid var(--line)`; `CanonMeter` → always `--ink-max` fill, drop gold branch; `StatusPill` → glyph+label (`●/✕/?/≠`), no hue; `CoverSlot` → grayscale hatch + `filter:grayscale(1)` on `src`.
- **Icons:** stroke `1.6 → 1.25`.
- **Cards:** remove `backdrop-filter:blur` + shadow; flat hairline; drop `translateY(-6px)` lifts.
- Collapse the double `::selection`; scrollbars → `--line-hard` square.

**Exit:** Primitives render monochrome/square everywhere they're consumed; canon reads via weight+marker not color; no blur on cards. Visual diff confined to primitives.
**Effort: M.**

---

### P3 — Story core (Landing, Catalog, Reader, StoryTree, Compose)
**Files:** `src/app.jsx` (Landing L549–635, Catalog L666–725, MiniTree L638–663, Reader/`ReadingColumn`, `StoryTree`, `Compose`, `GenreWheel`, `RichEditor`); `src/styles.css` (`.story-card`, `.tnode`, `.fork-mini`, `.compose-input`, `.edit-tool`, `.desk-*`, `.reader-grid`/`.compose-grid` collapse 940→800, rail 340).

- Hero accent span → ink weight-700; serif lede → Helvetica. Flagship `.card.framed` → Swiss double-frame. MiniTree → ink squares + hairline edges.
- Catalog: PageHead d2, square tags, grayscale CoverSlot reveal, "В огне" ink badge, skeleton/empty/error states.
- StoryTree: edges ink-weight (canon 2px hard), `.tnode` square + `★` canon marker + Swiss-frame selected, drop glow/lift; flat bg.
- Reader: mode toggle ink-fill, serif body → Helvetica (optional `body.reading-serif` opt-in), canon-child card → ink + `★`, font-scale `aria-live`.
- Compose: square inputs/`.edit-tool`, GenreWheel alpha-ink sectors (keyboard-focusable), desk-bar de-glass, word-goal ink fill, character-fate via StatusPill glyphs.

**Exit:** All five story-core screens fully reframed; grids collapse at 800px; rails 340px; no hue in tree/wheel/cover.
**Effort: L** (most screens, most inline-oklch edits, RichEditor blockquote rule).

---

### P4 — Social (Feed, Communities, Profile, Social, Auth, menus)
**Files:** `src/app.jsx` (`FeedComposer` L3088, `PostCard` L3140, `Feed` L3381, `CommunityCard` L3456, `Communities` L3482, `CommunityCreate` L3518, `CommunityDetail` L3583, `Profile` L3687, `Social` L3783, `AuthModal` L2798, `NotificationsMenu` L2923, `AccountMenu` L2966).

- Apply shared restyles (P2 primitives) across all social cards; tabs → scaleX ink underline (`role=tablist`).
- **Banners:** `oklch` hue gradients → grayscale diagonal hatch + `mix-blend-mode:difference` name (`CommunityCard`/`CommunityDetail`/`CommunityCreate`).
- **CommunityCreate hue slider:** decide remove vs repurpose to hatch-angle (see Critical Decisions).
- AuthModal: remove overlay blur, Swiss-frame card, ink-only error (no red), `W` weight-700, OAuth tiles monochrome, focus-trap kept.
- Notifications/Account menus: de-glass `.studio-pop`, unread dot → ink square, ink-fill badge.
- Standardize empty/loading/error: mono `--ink-3` + grayscale hatch skeletons + `aria-live`.

**Exit:** Social group monochrome; banners grayscale; auth/menus de-glassed; consistent terminal empty/loading/error.
**Effort: L.**

---

### P5 — Studio + Plugins + Settings
**Files:** `src/app.jsx` (`Merge` L1508, `LoreGraph` L1733, `Stakes` L1953, `WritersRoom` L2139, `ReadersCut` L2348, `PluginsScreen` L2629, FX overlays L2540–2619, `SettingsDrawer` L3977, `ACCENTS`/`FONTS` L3811–3822).

- **Delete `ACCENTS`** + remove "Акцентный цвет" Field + `setAccent`. **`FONTS`:** remove picker or replace with in-language display options.
- Studio shells: rail 340, eyebrow blink, Swiss frames, canon-by-weight; Merge diff add/del by glyph+weight (no green/orange); LoreGraph nodes status-glyph + severity-by-rule-weight; Stakes leader by `★`+frame, royalty by alpha steps; WritersRoom live badge → blinking ink square, caret kept; ReadersCut spine hairline + `★`.
- Plugins: category dots → ink squares; **remove `PLUGIN_COLORS`/`bColor` color picker** + `p.color` usage; FX overlays monochrome (embers ink, progress flat, dice/hud/chip square ink); **wire or remove dead custom `fab-r` onClick**.
- SettingsDrawer de-glass + left hairline; toggle/range square ink; theme tiles paper/inverted.
- StudioMenu: leave unmounted (flag dead code).

**Exit:** All studio mechanics + plugin store + settings monochrome; color picker gone; no dead interactions left unflagged.
**Effort: L** (5 studio screens carry the heaviest inline-oklch density).

---

### P6 — Backend surfacing (latent systems → UI)
**Files:** `src/lib/store.js`, `src/app.jsx`, `pb_hooks/wyrm.pb.js`, `realtime/server.js`, `src/lib/i18n.js`.

Sequenced by cost (per backend plan §Sequencing):
1. **Zero-backend wins:** `coAppearEdges` LoreGraph "Связи" tab; reputation HUD (`REP nnn`); notification deep-links; live ticker; workspace-sync indicator.
2. **Small store additions:** `listBookmarks()` (Profile → Закладки); `reader_cuts` CRUD (`saveCut`/`listCuts`/`deleteCut`); `post.media` send + PostCard thumb; email-verification strip + resend.
3. **Larger systems:** `merge_requests` workflow (`list/create/approve/merge` + inbox UI); `room_turn` server producer + client deep-link.
4. **i18n:** `RU/EN` switch in Settings; fill `en` dict; thread `t()` incrementally.

**Exit:** Each surfaced capability reachable + functional in both PB and demo/LS modes; merge persists as MR; bookmarks queryable; media renders.
**Effort: L** (only phase touching backend; scope-gated by the user — see Critical Decisions).

---

### P7 — Motion, grain, terminal accents
**Files:** `src/styles.css` (`.atmos::after`, `.gate-grain`, `.view`, `.live-badge`, `.caret`), `src/app.jsx` (eyebrows/labels gain `<span class="blink">▋</span>`, optional `.route-flash` in `go()`).

- Animated `noise` grain on `.atmos::after` + `.gate-grain`, every route.
- `viewIn` route transition; optional 1-frame invert `.route-flash`.
- Blink cursors on Gate eyebrow, live-badge, footer, section eyebrows, loading states; live-badge dot → blinking ink square.
- Color/border hovers on `--ms-color`; transforms on `--t-snap`.

**Exit:** Grain breathes app-wide; terminal-lab cursors present; route changes animate; **all gated by reduced-motion** (grain freezes, blink solid, invert instantaneous).
**Effort: M.**

---

### P8 — A11y + QA + test repair
**Files:** `tests/*`, all touched components.

- Verify focus-traps (Auth, drawer, mobile menu, gate welcome), Escape-closes, focus-return-to-opener.
- `aria-pressed`/`aria-selected`/`role=tablist`/`switch` on all toggles/tabs; SVG GenreWheel + StoryTree nodes are focusable buttons with labels; canon/status never color-only.
- `aria-live` on optimistic errors, scale %, comment append.
- Reduced-motion full sweep; contrast check `--ink`/`--ink-2`/`--ink-3` on both themes (WCAG AA).
- Repair tests broken by renamed themes/removed ACCENTS/changed class behavior; add tests for `routeStack`/back, `listBookmarks`, merge_requests.

**Exit:** Existing suite green; new back/bookmark/MR tests pass; keyboard-only traversal works on every screen; axe/contrast clean.
**Effort: M.**

---

## 2. CRITICAL DECISIONS (user must confirm before build)

| # | Decision | Options | Recommendation | Blocks |
|---|---|---|---|---|
| **D1** | **Display face (Unhuman substitute)** | Space Grotesk (free OFL) · PP Neue Montreal / Söhne (paid, closer to Unhuman) | **Space Grotesk** unless licensing budget exists | P0 (can't author font-face without it) |
| **D2** | **Any color, or full monochrome?** | A: full grayscale (drop all 5 ACCENTS + genre hue) · B: keep one genre pip as the lone color | **A (purist)** — matches reframed strict mono | P2/P3/P4 (GenreWheel, Tag dot) |
| **D3** | **Keep two themes/accents?** | Drop accents (decided) but: keep Paper+Inverted as the two "modes," delete Night/Manuscript | **Keep Paper+Inverted, delete old themes + ACCENTS array** | P0/P5 |
| **D4** | **WebGL starfield ("Stars")** | Build WebGL · CSS-only star layer · **Skip** | **Skip** — not in WYRM today, perf/maintenance cost high; Gate lab-geometry + grain already deliver the vibe. Revisit post-ship. | P1/P7 |
| **D5** | **Backend-surfacing scope (P6)** | Full (all 10 gaps) · Zero-backend wins only · None this cycle | **Tier 1+2** (zero-backend + small store adds); defer `merge_requests` + `room_turn` server work to a follow-up | P6 size |
| **D6** | **CommunityCreate hue slider** | Remove · Repurpose to hatch angle/density | **Remove** (banners are grayscale; hue is meaningless) | P4 |
| **D7** | **Serif in Reader** | Fully retired · keep `body.reading-serif` opt-in | **Opt-in off by default** | P0/P3 |
| **D8** | **FONTS picker** | Remove · keep with in-language options | **Remove** (mono system implies one face) | P5 |

---

## 3. RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|---|---|---|
| **Animated grain (`noise`) perf** — full-bleed overlay animating every frame on every route | Jank on low-end/mobile; battery drain | `steps(4)` (not smooth), `transform`-only (GPU), single fixed layer, `mix-blend-mode:overlay`; **freeze under reduced-motion**; cap to `.atmos::after` (one instance). Profile on a throttled device in P7. |
| **`backdrop-filter:invert()` cost** — invert-on-hover on many elements | Repaint cost, Safari quirks, mobile no-support | Use `::after` overlay toggled by `opacity` (compositor-cheap); provide **ink-fill swap fallback** for large cards; `-webkit-` prefix; test Safari/iOS. |
| **WebGL** (if D4=build) | Largest perf/maintenance risk | Default **skip**; if built, lazy-load + `prefers-reduced-motion` kill + FPS budget. |
| **Reduced-motion regressions** | A11y/legal; motion-sensitive users | Reduced-motion is a **per-phase exit criterion**, not P8-only. Global kill-switch + explicit freezes for grain/blink/route-flash/parallax. |
| **RU localization of new copy** | New strings (`← НАЗАД`, `// загрузка…`, MR statuses, verify strip) ship English-flavored | All new copy authored in RU from the spec; route through `t()` where i18n lands (P6); keep a strings checklist in PR. |
| **4137-line single-file regression** | One file, no module boundaries → wide blast radius, merge pain | Phase-scoped edits by component line-range; **never reformat untouched regions**; rely on compat aliases so unedited components keep working; commit per phase; `git diff --stat` review gate. |
| **Cascade conflicts** (two override layers) | Edits silently lose to later declaration | Always edit the **later** of the two appended blocks; grep each selector before editing to find all declarations. |
| **ctx stale-payload leak fix** (P1) | Changing `ctx` reset semantics could break Reader/Compose that rely on accumulation | Add targeted tests for cross-story navigation; scope reset to story-boundary keys only. |
| **Test suite breakage** | Renamed themes, deleted ACCENTS, changed active-state classes break assertions | Inventory test references to `night`/`manuscript`/`accent` first; update in lockstep within each phase; P8 dedicated repair. |
| **PB/demo dual-path drift** (P6) | New store fns must work in both PB and LS | Mirror existing two-path pattern; test each new fn in `enabled` and demo modes. |

---

## 4. EFFORT + SHIP ORDER

| Phase | Effort | Ships independently? | State after shipping |
|---|---|---|---|
| **P0** tokens/fonts | **M** | Yes | Monochrome base, app runnable, components await restyle |
| **P1** shell/nav/gate/history | **L** | Yes | Real back button, theme rename, de-glassed shell, on-brand Gate |
| **P2** primitives | **M** | Yes | All buttons/tags/cards/avatars square+mono everywhere |
| **P3** story core | **L** | Yes | Catalog/Reader/Tree/Compose fully reframed |
| **P4** social | **L** | Yes | Feed/Communities/Profile/Auth reframed |
| **P5** studio/plugins/settings | **L** | Yes | All mechanics + settings mono; color picker gone |
| **P6** backend surfacing | **L** | Yes (per-feature) | Latent backend reachable (scope per D5) |
| **P7** motion/grain | **M** | Yes | Terminal-lab motion app-wide |
| **P8** a11y/QA | **M** | Final gate | Tests green, keyboard+contrast clean |

**Suggested incremental ship order:** P0 → P1 → P2 → P3 → P4 → P5 → P7 → P6 → P8.

Rationale: P0–P2 give a coherent monochrome system the visual phases (P3–P5) build on. **P7 (motion) before P6 (backend)** so the *look* is fully shipped and demoable before net-new feature/server work begins — and P6 can be descoped (D5) without blocking the redesign. P8 runs last as the QA gate, but its reduced-motion and a11y checks are enforced incrementally as exit criteria in every prior phase. The app is runnable and visually consistent after **every** phase; no phase requires a "big bang" merge.

**Critical path:** D1 (font) blocks P0; P0 blocks everything; P1's history/`ctx` rework is the highest-risk single change and should land early with focused tests. The two backend-heavy items in P6 (`merge_requests`, `room_turn`) are the only work requiring PB/realtime server changes and are the natural cut-line if timeline compresses.

---

**Files referenced:** `/Users/bubble3/Desktop/WYRM - книга/src/app.jsx`, `/Users/bubble3/Desktop/WYRM - книга/src/styles.css`, `/Users/bubble3/Desktop/WYRM - книга/src/lib/store.js`, `/Users/bubble3/Desktop/WYRM - книга/src/lib/realtime.js`, `/Users/bubble3/Desktop/WYRM - книга/src/lib/consistency.js`, `/Users/bubble3/Desktop/WYRM - книга/src/lib/diff.js`, `/Users/bubble3/Desktop/WYRM - книга/src/lib/i18n.js`, `/Users/bubble3/Desktop/WYRM - книга/pb_hooks/wyrm.pb.js`, `/Users/bubble3/Desktop/WYRM - книга/pb_migrations/1719000000_wyrm_init.js`, `/Users/bubble3/Desktop/WYRM - книга/realtime/server.js`, `/Users/bubble3/Desktop/WYRM - книга/tests/`.

---
