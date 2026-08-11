/*******************************************************************************************
 *  FIELD OFFICER LOCATION TRACKER  —  Cloudflare Worker entry point
 *  ----------------------------------------------------------------------------------------
 *  Routes
 *    GET  /                     Field officer check-in page (photo, name, mobile, location)
 *    GET  /manager              Manager dashboard (map, radius search, table, analytics)
 *    GET  /admin                Officer master list (add / CSV bulk import)
 *    GET  /setup                One-time bindings check + table creation
 *    GET  /photo/:key           Serves an officer photo from R2
 *
 *    GET  /api/officers         Active officer list (public, powers the dropdown)
 *    GET  /api/geo/search       Place search   (OpenStreetMap, cached 7 days at the edge)
 *    GET  /api/geo/reverse      Reverse geocode
 *    POST /api/checkin          Submit a check-in
 *    POST /api/login            Validate a manager / admin passcode
 *    GET  /api/dashboard        All check-ins + officers      [manager passcode]
 *    GET  /api/nearby           Radius search, server-side    [manager passcode]
 *    GET  /api/admin/officers   Full officer list             [admin passcode]
 *    POST /api/admin/officers   Create / update officers      [admin passcode]
 *    POST /api/admin/officer/toggle | /delete                 [admin passcode]
 *
 *  Bindings expected (see wrangler.toml)
 *    DB        D1 database
 *    PHOTOS    R2 bucket
 *
 *  Variables and secrets
 *    MANAGER_PASS   secret,  required
 *    ADMIN_PASS     secret,  optional (falls back to MANAGER_PASS)
 *    ORG_NAME       var,     optional  shown in the header bar
 *    CONTACT_EMAIL  var,     optional  sent to OpenStreetMap in the User-Agent
 *    LOCATIONIQ_KEY secret,  optional  switches geocoding to LocationIQ
 *
 *  See README.md for the full GitHub + Cloudflare setup.
 *******************************************************************************************/

import { page, APP_NAME } from './ui/page.js';
/* OpenStreetMap asks for a contact address in the User-Agent.
   Set CONTACT_EMAIL in wrangler.toml so your traffic is not rate-limited. */
function userAgent(env) {
  const mail = (env && env.CONTACT_EMAIL) || 'admin@example.com';
  return 'FieldOfficerTracker/1.0 (Cloudflare Worker; contact: ' + mail + ')';
}

let SCHEMA_READY = false;

/* =========================================================================================
   ROUTER
   ========================================================================================= */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (p === '/setup')            return await handleSetup(env);
      if (p.startsWith('/photo/'))   return await handlePhoto(url, env);

      if (p.startsWith('/api/')) {
        await ensureSchema(env);
        const res = await handleApi(p, request, env, ctx);
        res.headers.set('cache-control', 'no-store');
        return res;
      }

      if (p === '/manager') return htmlResponse(page('manager', env));
      if (p === '/admin')   return htmlResponse(page('admin', env));
      if (p === '/')        return htmlResponse(page('officer', env));

      return new Response('Not found', { status: 404 });
    } catch (err) {
      return json({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
    }
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function htmlResponse(body) {
  return new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}

/* =========================================================================================
   D1 SCHEMA
   ========================================================================================= */
async function ensureSchema(env) {
  if (SCHEMA_READY) return;
  if (!env.DB) throw new Error('D1 binding "DB" is missing. Add it in Worker > Settings > Bindings.');

  await env.DB.batch([
    env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS officers (' +
      'id TEXT PRIMARY KEY, name TEXT NOT NULL, mobile TEXT, designation TEXT, branch TEXT, ' +
      'home_address TEXT, home_lat REAL, home_lng REAL, photo_key TEXT, ' +
      'active INTEGER DEFAULT 1, updated_at TEXT)'
    ),
    env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS checkins (' +
      'id TEXT PRIMARY KEY, ts INTEGER, officer_id TEXT, name TEXT, mobile TEXT, ' +
      'designation TEXT, branch TEXT, photo_key TEXT, lat REAL, lng REAL, accuracy REAL, ' +
      'address TEXT, city TEXT, state TEXT, pincode TEXT, loc_type TEXT, notes TEXT, source TEXT)'
    ),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_checkins_ts ON checkins(ts DESC)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_checkins_mobile ON checkins(mobile)'),
    env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_officers_mobile ON officers(mobile)')
  ]);

  SCHEMA_READY = true;
}

async function handleSetup(env) {
  const missing = [];
  if (!env.DB)     missing.push('D1 binding "DB"');
  if (!env.PHOTOS) missing.push('R2 binding "PHOTOS"');
  if (!env.MANAGER_PASS) missing.push('Secret "MANAGER_PASS"');

  if (missing.length) {
    return htmlResponse(setupPage(false,
      'Still missing: <b>' + missing.join('</b>, <b>') + '</b>.<br>' +
      'Add them in wrangler.toml (or Worker &gt; Settings), redeploy, then reload this page.'));
  }

  await ensureSchema(env);
  const a = await env.DB.prepare('SELECT COUNT(*) AS n FROM officers').first();
  const b = await env.DB.prepare('SELECT COUNT(*) AS n FROM checkins').first();

  return htmlResponse(setupPage(true,
    'Tables are ready.<br>Officers: <b>' + a.n + '</b> &nbsp;·&nbsp; Check-ins: <b>' + b.n + '</b>'));
}

/* =========================================================================================
   AUTH
   ========================================================================================= */
function passOf(request) {
  return request.headers.get('x-pass') || '';
}

function checkManager(request, env) {
  const want = String(env.MANAGER_PASS || '');
  if (!want) return false;
  return safeEq(passOf(request), want);
}

function checkAdmin(request, env) {
  const want = String(env.ADMIN_PASS || env.MANAGER_PASS || '');
  if (!want) return false;
  return safeEq(passOf(request), want);
}

function safeEq(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* =========================================================================================
   HELPERS
   ========================================================================================= */
function uid(prefix) {
  return prefix + '-' + Date.now().toString(36) + '-' +
         Math.floor(Math.random() * 1e6).toString(36);
}

function cleanMobile(m) {
  return String(m == null ? '' : m).replace(/[^0-9]/g, '').slice(-10);
}

function num(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* =========================================================================================
   PHOTOS  (R2)
   ========================================================================================= */
async function handlePhoto(url, env) {
  if (!env.PHOTOS) return new Response('R2 not bound', { status: 500 });
  const key = 'photos/' + decodeURIComponent(url.pathname.slice('/photo/'.length));
  const obj = await env.PHOTOS.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const h = new Headers();
  h.set('content-type', (obj.httpMetadata && obj.httpMetadata.contentType) || 'image/jpeg');
  h.set('cache-control', 'public, max-age=31536000, immutable');
  h.set('etag', obj.httpEtag);
  return new Response(obj.body, { headers: h });
}

/* =========================================================================================
   GEOCODING  (OpenStreetMap Nominatim, or LocationIQ when a key is set)
   ========================================================================================= */
async function cachedFetch(target, ctx, env) {
  const cache = caches.default;
  const cacheKey = new Request(target, { method: 'GET' });
  let hit = await cache.match(cacheKey);
  if (hit) return hit;

  const res = await fetch(target, {
    headers: { 'User-Agent': userAgent(env), 'Accept-Language': 'en', 'Accept': 'application/json' }
  });
  const body = await res.text();
  const out = new Response(body, {
    status: res.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=604800' }
  });
  if (res.ok && ctx) ctx.waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}

function pickCity(a) {
  if (!a) return '';
  return a.city || a.town || a.village || a.municipality || a.suburb ||
         a.city_district || a.county || '';
}

async function geoSearch(q, env, ctx) {
  const key = env.LOCATIONIQ_KEY;
  const target = key
    ? 'https://us1.locationiq.com/v1/search?key=' + key + '&format=json&limit=6&countrycodes=in&addressdetails=1&q=' + encodeURIComponent(q)
    : 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=in&addressdetails=1&q=' + encodeURIComponent(q);

  const res = await cachedFetch(target, ctx, env);
  let arr = [];
  try { arr = await res.json(); } catch (e) { arr = []; }
  if (!Array.isArray(arr)) arr = [];

  return arr.map(r => ({
    address: r.display_name || '',
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon)
  })).filter(r => !isNaN(r.lat) && !isNaN(r.lng));
}

async function geoReverse(lat, lng, env, ctx) {
  const key = env.LOCATIONIQ_KEY;
  const la = Number(lat).toFixed(5), ln = Number(lng).toFixed(5);
  const target = key
    ? 'https://us1.locationiq.com/v1/reverse?key=' + key + '&format=json&addressdetails=1&lat=' + la + '&lon=' + ln
    : 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=' + la + '&lon=' + ln;

  let r = {};
  try {
    const res = await cachedFetch(target, ctx, env);
    r = await res.json();
  } catch (e) { r = {}; }

  const a = r.address || {};
  return {
    address: r.display_name || (Number(lat).toFixed(6) + ', ' + Number(lng).toFixed(6)),
    city: pickCity(a),
    state: a.state || '',
    pincode: a.postcode || ''
  };
}

/* =========================================================================================
   API
   ========================================================================================= */
async function handleApi(p, request, env, ctx) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  /* ---- public: officer dropdown ---- */
  if (p === '/api/officers' && method === 'GET') {
    const rs = await env.DB.prepare(
      'SELECT id, name, mobile, designation, branch, home_address, home_lat, home_lng, photo_key ' +
      'FROM officers WHERE active = 1 ORDER BY name COLLATE NOCASE'
    ).all();
    return json({ ok: true, officers: rs.results || [] });
  }

  /* ---- public: geocoding ---- */
  if (p === '/api/geo/search' && method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    if (q.length < 3) return json({ ok: true, results: [] });
    return json({ ok: true, results: await geoSearch(q, env, ctx) });
  }

  if (p === '/api/geo/reverse' && method === 'GET') {
    const lat = num(url.searchParams.get('lat')), lng = num(url.searchParams.get('lng'));
    if (lat === null || lng === null) return json({ ok: false, error: 'lat/lng required' }, 400);
    return json({ ok: true, ...(await geoReverse(lat, lng, env, ctx)) });
  }

  /* ---- public: submit a check-in ---- */
  if (p === '/api/checkin' && method === 'POST') {
    return await postCheckin(request, env, ctx);
  }

  /* ---- manager ---- */
  if (p === '/api/login' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const asAdmin = body.role === 'admin';
    const req = new Request(request.url, { headers: { 'x-pass': body.pass || '' } });
    const ok = asAdmin ? checkAdmin(req, env) : checkManager(req, env);
    return json({ ok, error: ok ? '' : 'Invalid passcode.' }, ok ? 200 : 401);
  }

  if (p === '/api/dashboard' && method === 'GET') {
    if (!checkManager(request, env)) return json({ ok: false, error: 'Invalid passcode.' }, 401);

    const c = await env.DB.prepare('SELECT * FROM checkins ORDER BY ts DESC LIMIT 5000').all();
    const o = await env.DB.prepare('SELECT * FROM officers WHERE active = 1 ORDER BY name COLLATE NOCASE').all();
    return json({
      ok: true,
      checkins: (c.results || []).map(shapeCheckin),
      officers: o.results || [],
      generated: new Date().toISOString()
    });
  }

  if (p === '/api/nearby' && method === 'GET') {
    if (!checkManager(request, env)) return json({ ok: false, error: 'Invalid passcode.' }, 401);
    const lat = num(url.searchParams.get('lat')), lng = num(url.searchParams.get('lng'));
    const km = num(url.searchParams.get('km')) || 5;
    if (lat === null || lng === null) return json({ ok: false, error: 'lat/lng required' }, 400);

    const c = await env.DB.prepare('SELECT * FROM checkins ORDER BY ts DESC LIMIT 5000').all();
    const seen = new Set(), out = [];
    for (const row of (c.results || [])) {
      const k = row.mobile || row.name;
      if (seen.has(k)) continue;
      seen.add(k);
      const d = haversine(lat, lng, row.lat, row.lng);
      if (d <= km) out.push({ ...shapeCheckin(row), distanceKm: Math.round(d * 100) / 100 });
    }
    out.sort((a, b) => a.distanceKm - b.distanceKm);
    return json({ ok: true, results: out });
  }

  /* ---- admin: officer master list ---- */
  if (p === '/api/admin/officers' && method === 'GET') {
    if (!checkAdmin(request, env)) return json({ ok: false, error: 'Invalid passcode.' }, 401);
    const rs = await env.DB.prepare('SELECT * FROM officers ORDER BY name COLLATE NOCASE').all();
    return json({ ok: true, officers: rs.results || [] });
  }

  if (p === '/api/admin/officers' && method === 'POST') {
    if (!checkAdmin(request, env)) return json({ ok: false, error: 'Invalid passcode.' }, 401);
    const body = await request.json().catch(() => ({}));
    const list = Array.isArray(body.officers) ? body.officers : [body];
    let saved = 0, skipped = 0;

    for (const o of list) {
      const name = String(o.name || '').trim();
      const mobile = cleanMobile(o.mobile);
      if (!name || mobile.length !== 10) { skipped++; continue; }
      await upsertOfficer(env, {
        officerId: o.id || o.officerId || '',
        name, mobile,
        designation: String(o.designation || '').trim(),
        branch: String(o.branch || '').trim(),
        homeAddress: String(o.homeAddress || o.home_address || '').trim(),
        homeLat: num(o.homeLat != null ? o.homeLat : o.home_lat),
        homeLng: num(o.homeLng != null ? o.homeLng : o.home_lng),
        photoKey: ''
      });
      saved++;
    }
    return json({ ok: true, saved, skipped });
  }

  if (p === '/api/admin/officer/toggle' && method === 'POST') {
    if (!checkAdmin(request, env)) return json({ ok: false, error: 'Invalid passcode.' }, 401);
    const body = await request.json().catch(() => ({}));
    await env.DB.prepare('UPDATE officers SET active = ?, updated_at = ? WHERE id = ?')
      .bind(body.active ? 1 : 0, new Date().toISOString(), String(body.id || '')).run();
    return json({ ok: true });
  }

  if (p === '/api/admin/officer/delete' && method === 'POST') {
    if (!checkAdmin(request, env)) return json({ ok: false, error: 'Invalid passcode.' }, 401);
    const body = await request.json().catch(() => ({}));
    await env.DB.prepare('DELETE FROM officers WHERE id = ?').bind(String(body.id || '')).run();
    return json({ ok: true });
  }

  /* ---- manager: delete a check-in ---- */
  if (p === '/api/checkin/delete' && method === 'POST') {
    if (!checkManager(request, env)) return json({ ok: false, error: 'Invalid passcode.' }, 401);
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || '');
    if (!id) return json({ ok: false, error: 'id required' }, 400);
    const row = await env.DB.prepare('SELECT photo_key FROM checkins WHERE id = ?').bind(id).first();
    await env.DB.prepare('DELETE FROM checkins WHERE id = ?').bind(id).run();
    if (row && row.photo_key && env.PHOTOS) {
      try { await env.PHOTOS.delete('photos/' + row.photo_key); } catch (e) {}
    }
    return json({ ok: true });
  }

  /* ---- manager: change ONLY the location of a check-in ---- */
  if (p === '/api/checkin/location' && method === 'POST') {
    if (!checkManager(request, env)) return json({ ok: false, error: 'Invalid passcode.' }, 401);
    const body = await request.json().catch(() => ({}));
    const lat = num(body.lat), lng = num(body.lng);
    if (!body.id || lat === null || lng === null)
      return json({ ok: false, error: 'id, lat and lng are required' }, 400);
    const geo = body.address
      ? { address: body.address, city: body.city || '', state: body.state || '', pincode: body.pincode || '' }
      : await geoReverse(lat, lng, env, ctx);
    await env.DB.prepare(
      'UPDATE checkins SET lat = ?, lng = ?, address = ?, city = ?, state = ?, pincode = ? WHERE id = ?'
    ).bind(lat, lng, geo.address, geo.city, geo.state, geo.pincode, String(body.id)).run();
    return json({ ok: true, address: geo.address });
  }

  return json({ ok: false, error: 'Unknown endpoint: ' + p }, 404);
}

function shapeCheckin(r) {
  const d = new Date(r.ts);
  return {
    id: r.id,
    ts: r.ts,
    tsText: fmtIST(d),
    dateKey: istDateKey(d),
    officerId: r.officer_id || '',
    name: r.name || '',
    mobile: r.mobile || '',
    designation: r.designation || '',
    branch: r.branch || '',
    photoKey: r.photo_key || '',
    lat: r.lat, lng: r.lng,
    accuracy: r.accuracy,
    address: r.address || '',
    city: r.city || '',
    state: r.state || '',
    pincode: r.pincode || '',
    type: r.loc_type || 'Current',
    notes: r.notes || ''
  };
}

function istParts(d) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
  return f.format(d);
}

function fmtIST(d) { return istParts(d); }

function istDateKey(d) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

async function upsertOfficer(env, o) {
  const now = new Date().toISOString();
  const existing = o.mobile
    ? await env.DB.prepare('SELECT * FROM officers WHERE mobile = ?').bind(o.mobile).first()
    : null;

  if (existing) {
    await env.DB.prepare(
      'UPDATE officers SET name = ?, designation = ?, branch = ?, home_address = ?, ' +
      'home_lat = ?, home_lng = ?, photo_key = ?, active = 1, updated_at = ? WHERE id = ?'
    ).bind(
      o.name || existing.name,
      o.designation || existing.designation || '',
      o.branch || existing.branch || '',
      o.homeAddress || existing.home_address || '',
      o.homeLat != null ? o.homeLat : existing.home_lat,
      o.homeLng != null ? o.homeLng : existing.home_lng,
      o.photoKey || existing.photo_key || '',
      now, existing.id
    ).run();
    return existing.id;
  }

  const id = o.officerId || uid('OFC');
  await env.DB.prepare(
    'INSERT INTO officers (id, name, mobile, designation, branch, home_address, home_lat, ' +
    'home_lng, photo_key, active, updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?)'
  ).bind(id, o.name, o.mobile, o.designation || '', o.branch || '',
         o.homeAddress || '', o.homeLat, o.homeLng, o.photoKey || '', now).run();
  return id;
}

async function postCheckin(request, env, ctx) {
  const b = await request.json().catch(() => ({}));

  const name = String(b.name || '').trim();
  const mobile = cleanMobile(b.mobile);
  const lat = num(b.lat), lng = num(b.lng);

  if (!name)                        return json({ ok: false, error: 'Officer name is required.' }, 400);
  if (mobile.length !== 10)         return json({ ok: false, error: 'Enter a valid 10-digit mobile number.' }, 400);
  if (lat === null || lng === null) return json({ ok: false, error: 'Location is required.' }, 400);
  if (!b.photoBase64)               return json({ ok: false, error: 'Photo is required.' }, 400);

  /* photo -> R2 */
  let photoKey = '';
  if (b.photoBase64) {
    if (!env.PHOTOS) return json({ ok: false, error: 'R2 binding "PHOTOS" is missing.' }, 500);
    const bytes = b64ToBytes(b.photoBase64);
    if (bytes.length > 3 * 1024 * 1024) return json({ ok: false, error: 'Photo too large.' }, 413);
    photoKey = mobile + '-' + Date.now() + '.jpg';
    await env.PHOTOS.put('photos/' + photoKey, bytes, {
      httpMetadata: { contentType: b.photoMime || 'image/jpeg' }
    });
  }

  /* address */
  let geo;
  if (b.address) {
    geo = { address: b.address, city: b.city || '', state: b.state || '', pincode: b.pincode || '' };
  } else {
    geo = await geoReverse(lat, lng, env, ctx);
  }

  const id = uid('CHK');
  await env.DB.prepare(
    'INSERT INTO checkins (id, ts, officer_id, name, mobile, designation, branch, photo_key, ' +
    'lat, lng, accuracy, address, city, state, pincode, loc_type, notes, source) ' +
    'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(
    id, Date.now(), b.officerId || '', name, mobile,
    b.designation || '', b.branch || '', photoKey,
    lat, lng, num(b.accuracy),
    geo.address, geo.city, geo.state, geo.pincode,
    b.locationType || 'Current', b.notes || '', b.source || 'Web'
  ).run();

  const officerId = await upsertOfficer(env, {
    officerId: b.officerId,
    name, mobile,
    designation: b.designation, branch: b.branch,
    homeAddress: b.locationType === 'Home' ? geo.address : (b.homeAddress || ''),
    homeLat: b.locationType === 'Home' ? lat : num(b.homeLat),
    homeLng: b.locationType === 'Home' ? lng : num(b.homeLng),
    photoKey
  });

  return json({ ok: true, id, officerId, photoKey, address: geo.address });
}

/* =========================================================================================
   SETUP PAGE
   ========================================================================================= */
function setupPage(ok, msg) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Setup</title>' +
    '<style>body{font-family:Segoe UI,Roboto,Arial,sans-serif;background:#f4f7fb;margin:0;' +
    'display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}' +
    '.b{background:#fff;max-width:520px;padding:34px;border-radius:16px;' +
    'box-shadow:0 6px 24px rgba(0,31,63,.12);text-align:center}' +
    '.i{width:76px;height:76px;border-radius:50%;margin:0 auto 18px;display:flex;' +
    'align-items:center;justify-content:center;font-size:34px;color:#fff;background:' +
    (ok ? '#2ecc71' : '#e67e22') + '}' +
    'h1{color:#001f3f;font-size:21px;margin:0 0 10px}p{color:#48607a;line-height:1.7;font-size:14.5px}' +
    'a{display:inline-block;margin:6px 5px 0;padding:11px 18px;border-radius:10px;' +
    'background:linear-gradient(135deg,#001f3f,#0074D9);color:#fff;text-decoration:none;font-size:14px}' +
    '</style></head><body><div class="b"><div class="i">' + (ok ? '&#10003;' : '!') + '</div>' +
    '<h1>' + (ok ? 'Setup complete' : 'Setup incomplete') + '</h1><p>' + msg + '</p>' +
    (ok ? '<a href="/">Officer link</a><a href="/manager">Manager dashboard</a><a href="/admin">Admin</a>' : '') +
    '</div></body></html>';
}

/* =========================================================================================
   THE APP  (single page, React 18 + Leaflet + DataTables + SweetAlert2 + Chart.js)
   ========================================================================================= */

/* =========================================================================================
   The HTML application itself lives in  src/ui/  —  page.js / styles.js / client.js
   ========================================================================================= */
