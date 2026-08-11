/* =====================================================================
   Backend routes for RecordsManager  —  add to your Cloudflare Worker.

   These mirror your existing  POST /api/admin/officer/delete  route:
   same admin-pass check, same JSON `{ ok: true }` reply shape.

   >>> ADAPT 2 THINGS to your Worker (both marked ADAPT below):
       1. the admin-auth guard  (copy whatever /api/admin/officer/delete uses)
       2. the D1 binding + table/column names  (match your /api/checkin insert)
          - Below assumes:  env.DB  ,  table `checkins`  ,  columns
            id, lat, lng, address, city, state, ts, dateKey, tsText
          If any name differs, change it here — nothing else.

   If your check-ins live in KV/Durable Object instead of D1, tell me and
   I'll swap the 3 bodies; the routing + the front-end contract stay identical.
   ===================================================================== */

/* ---- ADAPT #1: reuse your own admin-pass check ---------------------- */
function requireAdmin(request, env) {
  const pass = request.headers.get('x-pass') || '';
  // Match whatever /api/admin/* already compares against (e.g. env.ADMIN_PASS):
  return pass && pass === env.ADMIN_PASS;
}
const J = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

/* ---- Add these three branches inside your fetch() router ------------ */
/*
   Example placement (Workers module syntax):

     if (url.pathname === '/api/admin/checkin/delete'   && request.method === 'POST') return checkinDelete(request, env);
     if (url.pathname === '/api/admin/checkin/relocate' && request.method === 'POST') return checkinRelocate(request, env);
     if (url.pathname === '/api/admin/checkin/redate'   && request.method === 'POST') return checkinRedate(request, env);
*/

/* 1) DELETE one check-in ------------------------------------------------ */
async function checkinDelete(request, env) {
  if (!requireAdmin(request, env)) return J({ ok: false, error: 'Unauthorized' }, 401);
  const { id } = await request.json();
  if (!id) return J({ ok: false, error: 'Missing id' }, 400);
  // ADAPT #2: table name if not `checkins`
  await env.DB.prepare('DELETE FROM checkins WHERE id = ?').bind(id).run();
  // (Optional) also delete the photo blob from R2/KV here if you store one:
  //   const row = ... ; if (row?.photoKey) await env.PHOTOS.delete(row.photoKey);
  return J({ ok: true });
}

/* 2) RELOCATE — change ONLY the location fields ------------------------- */
async function checkinRelocate(request, env) {
  if (!requireAdmin(request, env)) return J({ ok: false, error: 'Unauthorized' }, 401);
  const { id, lat, lng, address = '', city = '', state = '' } = await request.json();
  if (!id || lat == null || lng == null) return J({ ok: false, error: 'Missing id/lat/lng' }, 400);
  await env.DB.prepare(
    'UPDATE checkins SET lat = ?, lng = ?, address = ?, city = ?, state = ? WHERE id = ?'
  ).bind(lat, lng, address, city, state, id).run();
  return J({ ok: true });
}

/* 3) REDATE — change ONLY the date/time -------------------------------- */
async function checkinRedate(request, env) {
  if (!requireAdmin(request, env)) return J({ ok: false, error: 'Unauthorized' }, 401);
  const { id, ts, dateKey, tsText } = await request.json();
  if (!id || !ts) return J({ ok: false, error: 'Missing id/ts' }, 400);
  // Update whichever time columns your table actually has:
  await env.DB.prepare(
    'UPDATE checkins SET ts = ?, dateKey = ?, tsText = ? WHERE id = ?'
  ).bind(ts, dateKey, tsText, id).run();
  return J({ ok: true });
}

/* If you use service-worker syntax instead of module syntax, replace
   `env` with your global bindings (DB, ADMIN_PASS) and register the routes
   in your addEventListener('fetch', ...) switch the same way. */
export { checkinDelete, checkinRelocate, checkinRedate };
