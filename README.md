# SKD GPS Dashboard — changes so far

Three changes for `map.gpsk-ts.workers.dev`, bundled together. Everything is
built to match your existing app (React 18 + Leaflet + your `api()`,
`haversine()`, `LocationPicker`, `photoUrl()` helpers). Apply them, commit the
changed Worker file to your GitHub repo, and Cloudflare redeploys.

## What's inside

```
1-map-bigger/            Make the map big; it no longer shrinks as officers grow
    map-bigger.css           paste-in <style> block (easiest)
    map-bigger.EDITS.md      OR two exact find/replace CSS edits (cleanest)

2-pincode-nearest/       Manager types a PIN code -> ranked nearest field officers
    PincodeNearest.jsx       1st/2nd/3rd nearest badged, km shown, top-3 pinned on a mini map

3-records-delete-edit/   Delete a check-in, move ONLY its location, change its date
    RecordsManager.jsx       the UI card (reuses your LocationPicker)
    RecordsManager.backend.js  the 3 Worker routes it calls
```

## Apply order (all in your one Worker file / repo)

**1. Map bigger** — add the CSS. Either paste `map-bigger.css` inside a
`<style>` near the end of your `<head>`, or make the two edits in
`map-bigger.EDITS.md`. Nothing else changes.

**2. Pincode search** — paste the `PincodeNearest` function into your
`<script type="text/babel">` block (above `function ManagerDashboard`), then
render `<PincodeNearest />` where you want it (e.g. under the existing
"Search Officers Near a Location" card). Pure front-end, no backend change.

**3. Delete / edit records** — paste the `RecordsManager` function into the
same `<script type="text/babel">` block (above `function AdminPage`), render
`<RecordsManager />` (a new tab, or the bottom of the Admin page), then add the
three routes from `RecordsManager.backend.js` to your Worker's router.

> The backend routes assume your check-ins live in **Cloudflare D1** in a table
> called `checkins`. If your table/column names differ, or you use KV instead,
> send me the ~30 lines of your Worker that handle `POST /api/checkin` (the
> insert) and I'll return the three routes matched exactly. The map fix and the
> pincode search work regardless.

## Committing to GitHub

These are edits/additions to the single HTML+JS your Worker serves (and, for
step 3, its request router). Edit that file in your repo, commit, and push —
your existing GitHub → Cloudflare deploy takes it live. Nothing here needs new
dependencies or a build step.
