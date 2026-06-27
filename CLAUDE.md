# DailyDash

Single-file PWA dashboard for ADHD daily planning — habits, top tasks, MIT, deep work blocks, shutdown ritual, water tracking, brain dump notes, and brain reset journaling.

## Tech constraints

- **Vanilla web only.** No frameworks, no build tools, no npm. HTML, CSS, and JS in one `index.html` file.
- **No new dependencies.** The only external resource is the Tabler Icons webfont from CDN (already included). Do not add libraries or frameworks.
- **Keep it a single file** for now — do not split into separate CSS/JS files unless explicitly asked.
- **localStorage for persistence.** State is keyed under `adhd_dashboard_v1`. `getState()` reads, `persist()` writes. Every toggle reads→mutates→persists→renders.

## UX principles

- **PWA-first.** The manifest and service worker are there for a reason. Changes must work when installed to a home screen. Respect `env(safe-area-inset-*)` padding already in place.
- **Dark mode is a first-class citizen.** Every visual change must work in both light and dark schemes via the `--bg`, `--surface`, `--text`, `--accent`, `--success`, `--warning` design tokens defined in `:root` / `@media (prefers-color-scheme: dark)`.
- **Accessibility matters.** Keep `aria-label` attributes on icon-only buttons. Preserve focus styles already in place. Use semantic HTML.
- **Offline resilience.** The service worker currently does nothing — any step toward caching the app shell or icons improves the experience.

## Architecture reference

### Design tokens (CSS custom properties)

All colors come from the tokens in `:root`. Never hardcode a hex value — use the token. The system has:

| Token | Purpose |
|-------|---------|
| `--bg`, `--surface`, `--surface-2` | Backgrounds (page → card → inset) |
| `--border`, `--border-strong` | Borders |
| `--text`, `--text-secondary`, `--text-muted` | Text hierarchy |
| `--accent`, `--accent-bg`, `--accent-border`, `--accent-text` | Primary actions / deep work |
| `--success`, `--success-bg`, `--success-border` | Habits (completed state) |
| `--warning`, `--warning-bg`, `--warning-border` | MIT / shutdown (completed state) |
| `--radius: 12px` | Standard border radius |
| `--font` | System font stack |

### State shape

```js
{
  date: "Mon Jun 28 2026",     // day key — triggers reset if ≠ getToday()
  habits: { sleep, exercise, water },  // booleans
  br: "", brDone: false,        // ball roller
  mit: "", mitDone: false,      // most important task
  tasks: { 2: "", 3: "" },      // second and third priority text
  taskDone: { 2: false, 3: false },
  dw: { 1: false, 2: false },   // deep work blocks
  sd: { env, brain, plan },     // shutdown ritual
  water: 0,                      // ml
  notes: "",                     // brain dump (carries over)
  brPrompts: { loops, worry, wins, tmit, other },  // brain reset journal (own expiry)
  brPromptDate: "..."            // date prompts were written (clears at 9pm next day)
}
```

### Section pattern

Each dashboard section follows this structure:
1. `<div class="section">` wrapper
2. `<div class="section-title">` label
3. Content (cards, rows, inputs)
4. Done-state applied via `.done` or `.done-state` class on the container + CSS descendant selectors for visual changes

### Day lifecycle

- **Midnight rollover:** `getToday()` returns fresh date. `getState()` compares stored `s.date` against it. Mismatch → reset all daily fields, keep `notes` and `brPrompts`.
- **Visibility change / interval:** `checkDayRollover()` fires on `visibilitychange` and every 60s — catches midnight for PWAs kept open.
- **Brain reset expiry:** Prompts clear at 9pm the day after writing (separate from midnight rollover, via `getBrPromptDate()`).
- **Reset button:** Manual daily reset — keeps notes and brPrompts.
