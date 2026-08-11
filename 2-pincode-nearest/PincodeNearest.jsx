/* =====================================================================
   PincodeNearest  —  "Find nearest field officers by PIN code"
   Drop-in card for the SKD Health Manager dashboard.

   WHERE IT FITS
   -------------
   Your app already has, in the same <script type="text/babel"> block:
       • api(path)                     -> fetch helper (adds x-pass)
       • haversine(lat1,lng1,lat2,lng2)-> km between two points
       • photoUrl(key) / avatarFallback(name)
       • GET /api/dashboard            -> { ok, checkins:[ {id,name,mobile,
                                             address,city,lat,lng,photoKey} ] }
       • GET /api/geo/search?q=...     -> { results:[ {lat,lng,address} ] }
   This component only READS those. No backend change is required.

   HOW TO INSTALL  (3 lines of work)
   ---------------------------------
   1. Paste this whole function inside your  <script type="text/babel">
      block, anywhere ABOVE  function ManagerDashboard() { ... }.
   2. Inside ManagerDashboard's returned JSX, drop the tag where you want
      the card to appear (e.g. right under the "Search Officers Near a
      Location" card):
            <PincodeNearest />
   3. Save & redeploy the Worker. Done.

   The manager types a 6-digit PIN code -> it is geocoded -> every field
   officer's latest location is measured from that point -> the list is
   sorted nearest-first, the 1st / 2nd / 3rd nearest are badged gold /
   silver / bronze, and the top 3 are pinned (1,2,3) on a mini map.
   ===================================================================== */

function PincodeNearest() {
  const { useState, useRef, useEffect, useMemo, useCallback } = React;

  const [pin, setPin]       = useState('');
  const [radius, setRadius] = useState(0);      // 0 = "Any distance"
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState('');
  const [point, setPoint]   = useState(null);   // { lat, lng, address }
  const [officers, setOfficers] = useState([]); // latest-per-officer, with distanceKm

  const mapEl   = useRef(null);
  const mapRef  = useRef(null);
  const layerRef= useRef(null);

  const RADII = [
    { v: 0,  label: 'Any' },
    { v: 2,  label: '2 km' },
    { v: 5,  label: '5 km' },
    { v: 10, label: '10 km' },
    { v: 25, label: '25 km' },
    { v: 50, label: '50 km' },
  ];

  /* ---- de-dupe check-ins down to the latest location per officer ---- */
  function latestPerOfficer(checkins) {
    const seen = {}, out = [];
    (checkins || []).forEach(c => {
      const k = c.mobile || c.name;
      if (seen[k]) return;          // /api/dashboard returns newest-first
      seen[k] = 1;
      if (c.lat != null && c.lng != null) out.push(c);
    });
    return out;
  }

  /* ---- geocode a PIN code via your existing proxy ---- */
  async function geocodePin(code) {
    // try a few phrasings so bare Indian PINs resolve reliably
    const tries = [code + ', India', 'PIN ' + code + ', India', code];
    for (const q of tries) {
      try {
        const r = await api('/api/geo/search?q=' + encodeURIComponent(q));
        const hit = r && r.results && r.results[0];
        if (hit && hit.lat != null && hit.lng != null) return hit;
      } catch (e) { /* try next phrasing */ }
    }
    return null;
  }

  const search = useCallback(async () => {
    const code = (pin || '').trim();
    if (!/^\d{6}$/.test(code)) {
      setErr('Enter a valid 6-digit PIN code.');
      return;
    }
    setErr(''); setBusy(true); setPoint(null); setOfficers([]);
    try {
      const loc = await geocodePin(code);
      if (!loc) { setErr('Could not locate PIN ' + code + '. Try a nearby PIN.'); setBusy(false); return; }

      const dash = await api('/api/dashboard');
      if (!dash || !dash.ok) { setErr('Could not load officer locations. Please log in again.'); setBusy(false); return; }

      let list = latestPerOfficer(dash.checkins).map(c =>
        Object.assign({}, c, { distanceKm: haversine(loc.lat, loc.lng, c.lat, c.lng) })
      ).sort((a, b) => a.distanceKm - b.distanceKm);

      if (radius > 0) list = list.filter(c => c.distanceKm <= radius);

      setPoint(loc);
      setOfficers(list);
      if (list.length === 0) {
        setErr(radius > 0
          ? 'No field officers within ' + radius + ' km of PIN ' + code + '.'
          : 'No field officer locations available yet.');
      }
    } catch (e) {
      setErr('Something went wrong. Please try again.');
    }
    setBusy(false);
  }, [pin, radius]);

  /* ---- mini map: pincode marker + numbered pins for the top 3 ---- */
  useEffect(() => {
    if (!point || !mapEl.current) return;
    if (!mapRef.current) {
      mapRef.current = L.map(mapEl.current, { zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(mapRef.current);
      layerRef.current = L.layerGroup().addTo(mapRef.current);
    }
    const map = mapRef.current, layer = layerRef.current;
    layer.clearLayers();

    // the searched PIN point (red diamond)
    L.marker([point.lat, point.lng], {
      icon: L.divIcon({
        className: '',
        html: '<div style="width:22px;height:22px;transform:rotate(45deg);background:#e63946;border:2px solid #fff;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
        iconSize: [22, 22], iconAnchor: [11, 11],
      }),
    }).addTo(layer).bindPopup('PIN ' + pin.trim());

    if (radius > 0) {
      L.circle([point.lat, point.lng], { radius: radius * 1000, color: '#0074D9', weight: 1, fillOpacity: 0.05 }).addTo(layer);
    }

    const medal = ['#f2b100', '#9aa7b4', '#c07a33']; // gold, silver, bronze
    const top = officers.slice(0, 3);
    top.forEach((o, i) => {
      L.marker([o.lat, o.lng], {
        icon: L.divIcon({
          className: '',
          html: '<div style="width:28px;height:28px;line-height:26px;text-align:center;font-weight:800;color:#fff;background:' +
                medal[i] + ';border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)">' + (i + 1) + '</div>',
          iconSize: [28, 28], iconAnchor: [14, 14],
        }),
      }).addTo(layer).bindPopup('<b>#' + (i + 1) + ' ' + o.name + '</b><br>' + o.distanceKm.toFixed(2) + ' km away');
    });

    const pts = [[point.lat, point.lng]].concat(top.map(o => [o.lat, o.lng]));
    if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
    else map.setView([point.lat, point.lng], 13);
    setTimeout(() => map.invalidateSize(), 60);
  }, [point, officers, radius]);

  useEffect(() => () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } }, []);

  const medalBg = ['#fff8e1', '#f3f5f8', '#f7ede3'];
  const medalBar = ['#f2b100', '#9aa7b4', '#c07a33'];

  return (
    <div className="card">
      <h3><i className="fas fa-location-crosshairs" style={{ color: '#0074D9' }}></i> Find Nearest Field Officers by PIN Code</h3>

      {/* ---- input row ---- */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <input
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={e => { if (e.key === 'Enter') search(); }}
          inputMode="numeric"
          placeholder="Enter 6-digit PIN code (e.g. 600001)"
          style={{ flex: '1 1 220px', minWidth: 200, padding: '11px 14px', border: '1px solid #cfd8e3', borderRadius: 8, fontSize: 15, letterSpacing: 1 }}
        />
        <button className="btn btn-primary" disabled={busy} onClick={search} style={{ minWidth: 130 }}>
          {busy
            ? <span><i className="fas fa-spinner fa-spin"></i> Searching</span>
            : <span><i className="fas fa-magnifying-glass"></i> Find nearest</span>}
        </button>
      </div>

      {/* ---- radius chips ---- */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7c93', marginRight: 4 }}>WITHIN</span>
        {RADII.map(r => (
          <button
            key={r.v}
            onClick={() => setRadius(r.v)}
            style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              border: '1px solid ' + (radius === r.v ? '#0074D9' : '#d7dee7'),
              background: radius === r.v ? '#0074D9' : '#fff',
              color: radius === r.v ? '#fff' : '#33475b', fontWeight: radius === r.v ? 700 : 500,
            }}>
            {r.label}
          </button>
        ))}
      </div>

      {/* ---- resolved location + error ---- */}
      {point && (
        <div style={{ fontSize: 13, color: '#33475b', margin: '12px 0 4px' }}>
          <i className="fas fa-map-pin" style={{ color: '#e63946' }}></i>{' '}
          PIN <b>{pin.trim()}</b> — {point.address || (point.lat.toFixed(4) + ', ' + point.lng.toFixed(4))}
          {'  ·  '}<b>{officers.length}</b> officer{officers.length === 1 ? '' : 's'}{radius > 0 ? ' within ' + radius + ' km' : ''}
        </div>
      )}
      {err && (
        <div className="sd-empty" style={{ marginTop: 10 }}>
          <i className="fas fa-circle-info"></i> {err}
        </div>
      )}

      {/* ---- mini map ---- */}
      {point && officers.length > 0 && (
        <div ref={mapEl} style={{ height: 240, borderRadius: 10, overflow: 'hidden', margin: '12px 0', border: '1px solid #e3e9f0' }}></div>
      )}

      {/* ---- ranked list ---- */}
      {officers.length > 0 && (
        <div className="grid3">
          {officers.map((o, i) => (
            <div
              key={o.id}
              className="near-item"
              style={{
                marginBottom: 0,
                background: i < 3 ? medalBg[i] : '#fff',
                borderLeft: '4px solid ' + (i < 3 ? medalBar[i] : '#e3e9f0'),
              }}>
              {/* rank badge */}
              <div style={{
                position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: '50%',
                background: i < 3 ? medalBar[i] : '#001f3f', color: '#fff', fontWeight: 800,
                fontSize: 12, lineHeight: '22px', textAlign: 'center', zIndex: 1,
              }}>{i + 1}</div>

              <img src={photoUrl(o.photoKey) || avatarFallback(o.name)} alt=""
                   onError={e => { e.target.src = avatarFallback(o.name); }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="nm">
                  {i < 3 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: medalBar[i], marginRight: 6 }}>
                      {['1st nearest', '2nd nearest', '3rd nearest'][i]}
                    </span>
                  )}
                  {o.name}
                </div>
                <div className="mt"><i className="fas fa-phone"></i> {o.mobile}</div>
                {o.address && <div className="mt">{o.address}</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <a className="btn btn-soft btn-sm" href={'tel:' + o.mobile}><i className="fas fa-phone"></i></a>
                  <a className="btn btn-soft btn-sm" target="_blank" href={'https://wa.me/91' + o.mobile}><i className="fab fa-whatsapp"></i></a>
                  <a className="btn btn-soft btn-sm" target="_blank"
                     href={'https://www.google.com/maps/dir/?api=1&destination=' + o.lat + ',' + o.lng}>
                    <i className="fas fa-diamond-turn-right"></i>
                  </a>
                </div>
              </div>

              <div className="km">
                <b>{o.distanceKm.toFixed(2)}</b><small>KM AWAY</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
