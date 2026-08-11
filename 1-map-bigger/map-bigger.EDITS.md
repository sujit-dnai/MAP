# Map bigger — exact in-place edits (optional, cleanest)

Two one-line CSS changes. No line numbers — each anchor is unique, and the
first edit never moves the second.

---

### Edit 1 — make the map tall

**Search anchor:** `mgr-map`

**Select this (OLD):**
```css
.mgr-map{height:520px;border-radius:12px;border:1px solid var(--line)}
```

**Paste over it (NEW):**
```css
.mgr-map{height:74vh;min-height:560px;border-radius:12px;border:1px solid var(--line)}
```

---

### Edit 2 — match the officer list to the map height (so it scrolls, map stays fixed)

**Search anchor:** `near-list`

**Select this (OLD):**
```css
.near-list{max-height:520px;overflow-y:auto}
```

**Paste over it (NEW):**
```css
.near-list{max-height:74vh;overflow-y:auto}
```

---

### Edit 3 — (optional) make the map wider than the list

**Search anchor:** `grid-template-columns:1.35fr`

**Select this (OLD):**
```css
.grid2{display:grid;grid-template-columns:1.35fr 1fr;gap:16px}
```

**Paste over it (NEW):**
```css
.grid2{display:grid;grid-template-columns:1.35fr 1fr;gap:16px}
.grid2:has(.mgr-map){grid-template-columns:2fr 1fr}
```

That's it. Commit the file and your Cloudflare Worker redeploys from GitHub.
No Leaflet resize call is needed — the map initialises at the new size on load.
