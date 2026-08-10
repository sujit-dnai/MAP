/**
 * Browser-side application source (React 18 + JSX).
 *
 * This is shipped to the browser as-is inside a <script type="text/babel"> tag and
 * compiled in the browser by Babel Standalone, so no build step is required.
 * Keep it free of backticks and of dollar-brace sequences - it lives in a template literal.
 */
export const CLIENT_JS = `
const { useState, useEffect, useRef, useMemo, useCallback } = React;

var PASS = '';
try { PASS = sessionStorage.getItem('foPass') || ''; } catch (e) { PASS = ''; }
function rememberPass(p) { PASS = p; try { sessionStorage.setItem('foPass', p); } catch (e) {} }

async function api(path, opts) {
  opts = opts || {};
  const headers = Object.assign({ 'content-type': 'application/json' }, opts.headers || {});
  if (PASS) headers['x-pass'] = PASS;
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { data = { ok: false, error: 'Bad server response' }; }
  return data;
}

const DEFAULT_CENTER = [13.0827, 80.2707];

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function photoUrl(key) { return key ? '/photo/' + encodeURIComponent(key) : ''; }

function avatarFallback(name) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52">' +
    '<rect width="52" height="52" fill="#e8f2fb"/>' +
    '<text x="26" y="34" font-size="21" font-family="Arial" text-anchor="middle" fill="#0074D9">' +
    String(name || '?').charAt(0).toUpperCase() + '</text></svg>');
}

/* ---------------------------------------------------------------- SearchableDropdown */
function SearchableDropdown({ options, value, onChange, placeholder, icon, allowClear = true }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef(null), inp = useRef(null);

  useEffect(() => {
    const h = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => { if (open && inp.current) setTimeout(() => inp.current.focus(), 60); }, [open]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter(o => (o.label + ' ' + (o.sub || '')).toLowerCase().indexOf(s) > -1);
  }, [q, options]);

  const sel = options.find(o => String(o.value) === String(value));

  return (
    <div className="sd" ref={box}>
      <div className={'sd-ctrl' + (open ? ' open' : '')} onClick={() => setOpen(!open)}>
        {icon && <i className={'fas ' + icon} style={{ color: '#0074D9' }}></i>}
        <span className={'val' + (sel ? '' : ' ph')}>{sel ? sel.label : (placeholder || 'Select...')}</span>
        {sel && allowClear &&
          <i className="fas fa-times-circle" style={{ color: '#9aa9bd' }}
             onClick={e => { e.stopPropagation(); onChange(''); setOpen(false); }}></i>}
        <i className={'fas fa-chevron-' + (open ? 'up' : 'down')}
           style={{ fontSize: 11, color: '#9aa9bd' }}></i>
      </div>
      {open &&
        <div className="sd-pop">
          <div className="sd-search">
            <input ref={inp} value={q} placeholder="Type to search..."
                   onChange={e => setQ(e.target.value)} />
          </div>
          <div className="sd-list">
            {list.length === 0 && <div className="sd-empty">No match</div>}
            {list.map(o => (
              <div key={o.value} className={'sd-item' + (String(o.value) === String(value) ? ' hi' : '')}
                   onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}>
                {o.label}
                {o.sub && <small>{o.sub}</small>}
              </div>
            ))}
          </div>
        </div>}
    </div>
  );
}

/* ---------------------------------------------------------------- LocationPicker */
function LocationPicker({ initial, title, onCancel, onConfirm }) {
  const mapRef = useRef(null), elRef = useRef(null), geoT = useRef(null);
  const meta = useRef({ address: '', city: '', state: '', pincode: '' });
  const [addr, setAddr] = useState('Move the map to pin your location...');
  const [center, setCenter] = useState(initial && initial.lat ? [initial.lat, initial.lng] : null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [acc, setAcc] = useState(null);

  const reverse = useCallback((lat, lng) => {
    clearTimeout(geoT.current);
    setBusy(true);
    geoT.current = setTimeout(() => {
      api('/api/geo/reverse?lat=' + lat + '&lng=' + lng).then(r => {
        meta.current = r || {};
        setAddr((r && r.address) || (lat.toFixed(6) + ', ' + lng.toFixed(6)));
        setBusy(false);
      }).catch(() => { setBusy(false); setAddr(lat.toFixed(6) + ', ' + lng.toFixed(6)); });
    }, 700);
  }, []);

  useEffect(() => {
    const start = center || DEFAULT_CENTER;
    const map = L.map(elRef.current, { zoomControl: false }).setView(start, center ? 17 : 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapRef.current = map;

    map.on('moveend', () => {
      const c = map.getCenter();
      setCenter([c.lat, c.lng]);
      reverse(c.lat, c.lng);
    });

    setTimeout(() => map.invalidateSize(), 250);
    if (center) reverse(center[0], center[1]); else gps(true);
    return () => map.remove();
  }, []);

  function gps(silent) {
    if (!navigator.geolocation) {
      if (!silent) Swal.fire('Not supported', 'This device cannot share GPS location.', 'warning');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const la = pos.coords.latitude, ln = pos.coords.longitude;
        setAcc(Math.round(pos.coords.accuracy));
        mapRef.current.setView([la, ln], 17);
        setCenter([la, ln]);
        reverse(la, ln);
      },
      () => {
        setBusy(false);
        if (!silent) Swal.fire({
          icon: 'warning', title: 'Location blocked',
          html: 'Allow location access in your browser, then tap the <b>GPS</b> button again.' +
                '<br><br>You can also drag the map to pin your spot manually.'
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function doSearch() {
    const s = q.trim();
    if (s.length < 3) return;
    setSearching(true);
    api('/api/geo/search?q=' + encodeURIComponent(s)).then(r => {
      setResults((r && r.results) || []);
      setSearching(false);
    }).catch(() => { setSearching(false); setResults([]); });
  }

  return (
    <div className="lp-overlay">
      <div className="lp-top">
        <button className="back" onClick={onCancel}><i className="fas fa-arrow-left"></i></button>
        <div className="sbox">
          <input value={q} placeholder="Search area, street, landmark..."
                 onChange={e => setQ(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter') doSearch(); }} />
        </div>
        <button className="back" onClick={doSearch}>
          <i className={'fas ' + (searching ? 'fa-spinner fa-spin' : 'fa-search')}></i>
        </button>
      </div>

      <div className="lp-map-wrap">
        <div className="lp-map" ref={elRef}></div>
        <div className="lp-shadow"></div>
        <div className="lp-center"><i className="fas fa-map-marker-alt"></i></div>
        <button className="lp-gps" onClick={() => gps(false)}>
          <i className="fas fa-crosshairs"></i>
        </button>
        {results &&
          <div className="lp-results">
            <div style={{ padding: '9px 13px', borderBottom: '1px solid #e3e9f0', display: 'flex' }}>
              <b style={{ fontSize: 13, color: '#001f3f' }}>Search results</b>
              <i className="fas fa-times"
                 style={{ marginLeft: 'auto', color: '#6b7c93', cursor: 'pointer' }}
                 onClick={() => setResults(null)}></i>
            </div>
            {results.length === 0 && <div className="sd-empty">Nothing found. Try a nearby landmark.</div>}
            {results.map((r, i) => (
              <div key={i} className="sd-item"
                   onClick={() => { mapRef.current.setView([r.lat, r.lng], 17); setResults(null); setQ(''); }}>
                <i className="fas fa-location-dot" style={{ color: '#0074D9', marginRight: 8 }}></i>
                {r.address}
              </div>
            ))}
          </div>}
      </div>

      <div className="lp-bottom">
        <div className="lp-addr">
          <div className="pin"><i className="fas fa-map-pin"></i></div>
          <div className="txt">
            <b>{title || 'Pin your location'}</b>
            {busy
              ? <span style={{ color: '#6b7c93' }}><i className="fas fa-spinner fa-spin"></i> Reading address...</span>
              : addr}
            {center &&
              <div style={{ fontSize: 11, color: '#9aa9bd', marginTop: 4, fontFamily: 'monospace' }}>
                {center[0].toFixed(6)}, {center[1].toFixed(6)}{acc ? '  +/-' + acc + 'm' : ''}
              </div>}
          </div>
        </div>
        <button className="btn btn-primary btn-block" disabled={!center || busy}
                onClick={() => onConfirm({
                  lat: center[0], lng: center[1], accuracy: acc,
                  address: meta.current.address || addr,
                  city: meta.current.city || '', state: meta.current.state || '',
                  pincode: meta.current.pincode || ''
                })}>
          <i className="fas fa-paper-plane"></i> Send this location
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- OfficerForm */
function OfficerForm() {
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manual, setManual] = useState(false);
  const [picker, setPicker] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const [f, setF] = useState({
    sel: '', officerId: '', name: '', mobile: '', designation: '', branch: '', notes: '',
    photoData: '', photoMime: '', cur: null, home: null
  });
  const set = (k, v) => setF(p => Object.assign({}, p, { [k]: v }));

  useEffect(() => {
    api('/api/officers').then(r => {
      const list = (r && r.officers) || [];
      setOfficers(list);
      setLoading(false);
      if (!list.length) setManual(true);
    }).catch(() => { setLoading(false); setManual(true); });
  }, []);

  const opts = useMemo(() => officers.map((o, i) => ({
    value: String(i), label: o.name,
    sub: [o.mobile, o.designation, o.branch].filter(Boolean).join(' - ')
  })), [officers]);

  function pickOfficer(idx) {
    if (idx === '') {
      setF(p => Object.assign({}, p, { sel: '', officerId: '', name: '', mobile: '', designation: '', branch: '' }));
      return;
    }
    const o = officers[Number(idx)];
    setF(p => Object.assign({}, p, {
      sel: idx, officerId: o.id, name: o.name, mobile: o.mobile,
      designation: o.designation || '', branch: o.branch || '',
      home: (o.home_lat && o.home_lng)
        ? { lat: o.home_lat, lng: o.home_lng, address: o.home_address || '' } : p.home
    }));
  }

  function onPhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.type.indexOf('image/') !== 0) {
      Swal.fire('Invalid file', 'Please choose an image.', 'error');
      return;
    }
    const rd = new FileReader();
    rd.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const max = 900;
        let w = img.width, h = img.height;
        if (w > max || h > max) {
          const s = max / Math.max(w, h);
          w = Math.round(w * s); h = Math.round(h * s);
        }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        setF(p => Object.assign({}, p, {
          photoData: cv.toDataURL('image/jpeg', 0.72), photoMime: 'image/jpeg'
        }));
      };
      img.src = ev.target.result;
    };
    rd.readAsDataURL(file);
  }

  function submit() {
    if (!f.name.trim()) return Swal.fire('Name required', 'Select or type the officer name.', 'warning');
    if (f.mobile.replace(/\\D/g, '').length !== 10)
      return Swal.fire('Mobile required', 'Enter a valid 10-digit mobile number.', 'warning');
    if (!f.photoData) return Swal.fire('Photo required', 'Please capture or upload your photo.', 'warning');
    if (!f.cur) return Swal.fire('Location required', 'Tap "Set current location" and send your pin.', 'warning');

    Swal.fire({
      title: 'Submit check-in?',
      html: '<div style="text-align:left;font-size:14px;line-height:1.7"><b>' + f.name + '</b> - ' +
            f.mobile + '<br><span style="color:#6b7c93">' + (f.cur.address || '') + '</span></div>',
      icon: 'question', showCancelButton: true,
      confirmButtonText: 'Yes, submit', confirmButtonColor: '#0074D9'
    }).then(res => {
      if (!res.isConfirmed) return;
      setSaving(true);
      api('/api/checkin', {
        method: 'POST',
        body: {
          officerId: f.officerId, name: f.name.trim(), mobile: f.mobile.replace(/\\D/g, ''),
          designation: f.designation, branch: f.branch, notes: f.notes,
          photoBase64: f.photoData.split(',')[1], photoMime: f.photoMime,
          lat: f.cur.lat, lng: f.cur.lng, accuracy: f.cur.accuracy,
          address: f.cur.address, city: f.cur.city, state: f.cur.state, pincode: f.cur.pincode,
          locationType: 'Current', source: 'Web',
          homeLat: f.home ? f.home.lat : null, homeLng: f.home ? f.home.lng : null,
          homeAddress: f.home ? f.home.address : ''
        }
      }).then(r => {
        setSaving(false);
        if (!r || !r.ok) return Swal.fire('Could not save', (r && r.error) || 'Unknown error', 'error');
        setDone({ id: r.id, address: r.address });
      }).catch(err => {
        setSaving(false);
        Swal.fire('Network error', String(err), 'error');
      });
    });
  }

  if (loading) return <div className="loading"><div className="spin"></div>Loading officer list...</div>;

  if (done) return (
    <div className="wrap">
      <div className="card" style={{ textAlign: 'center', padding: '32px 18px' }}>
        <div style={{ width: 84, height: 84, borderRadius: '50%', background: '#e8f7ee', color: '#2ecc71',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 38, margin: '0 auto 16px' }}>
          <i className="fas fa-check"></i>
        </div>
        <h2 style={{ margin: '0 0 8px', color: '#001f3f', fontSize: 20 }}>Location submitted</h2>
        <p className="hint" style={{ fontSize: 13.5 }}>{done.address}</p>
        <p className="hint">Reference: <b>{done.id}</b></p>
        <button className="btn btn-outline btn-block" style={{ marginTop: 18 }}
                onClick={() => { setDone(null); setF(p => Object.assign({}, p, { cur: null, notes: '' })); }}>
          <i className="fas fa-rotate"></i> Submit another check-in
        </button>
      </div>
    </div>
  );

  return (
    <React.Fragment>
      {picker &&
        <LocationPicker
          title={picker === 'home' ? 'Set HOME location' : 'Set CURRENT location'}
          initial={picker === 'home' ? f.home : f.cur}
          onCancel={() => setPicker(null)}
          onConfirm={loc => { set(picker === 'home' ? 'home' : 'cur', loc); setPicker(null); }} />}

      <div className="wrap">
        <div className="card">
          <h3><i className="fas fa-camera"></i> Your Photo <span style={{ color: '#e74c3c' }}>*</span></h3>
          <label className={'photo-box' + (f.photoData ? ' filled' : '')} style={{ display: 'block' }}>
            <input type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={onPhoto} />
            {f.photoData
              ? <React.Fragment>
                  <img className="photo-prev" src={f.photoData} alt="photo" />
                  <div style={{ color: '#2ecc71', fontWeight: 700, fontSize: 13.5 }}>
                    <i className="fas fa-check-circle"></i> Photo captured - tap to change
                  </div>
                </React.Fragment>
              : <React.Fragment>
                  <div className="photo-ico"><i className="fas fa-camera-retro"></i></div>
                  <div style={{ fontWeight: 700, color: '#001f3f' }}>Tap to take a selfie</div>
                  <div className="hint">or choose a photo from your gallery</div>
                </React.Fragment>}
          </label>
        </div>

        <div className="card">
          <h3><i className="fas fa-id-card"></i> Officer Details</h3>

          {!manual &&
            <div className="field">
              <label>Field Officer <span className="req">*</span></label>
              <SearchableDropdown options={opts} value={f.sel} icon="fa-user-tie"
                                  placeholder="Search and select your name..." onChange={pickOfficer} />
              <p className="hint">Name not in the list?{' '}
                <a onClick={() => setManual(true)} style={{ cursor: 'pointer', fontWeight: 700 }}>
                  Enter manually</a>
              </p>
            </div>}

          {manual &&
            <React.Fragment>
              <div className="field">
                <label>Full Name <span className="req">*</span></label>
                <input className="inp" value={f.name} placeholder="e.g. Ramesh Kumar"
                       onChange={e => set('name', e.target.value)} />
              </div>
              {officers.length > 0 &&
                <p className="hint" style={{ marginTop: -8, marginBottom: 14 }}>
                  <a onClick={() => setManual(false)} style={{ cursor: 'pointer', fontWeight: 700 }}>
                    <i className="fas fa-list"></i> Pick from the officer list instead</a>
                </p>}
            </React.Fragment>}

          <div className="field">
            <label>Mobile Number <span className="req">*</span></label>
            <input className="inp" type="tel" inputMode="numeric" maxLength="10" value={f.mobile}
                   placeholder="10-digit mobile"
                   onChange={e => set('mobile', e.target.value.replace(/\\D/g, '').slice(0, 10))} />
          </div>

          {!manual && f.name &&
            <div className="field">
              <label>Selected</label>
              <input className="inp" readOnly value={f.name +
                (f.designation ? ' - ' + f.designation : '') + (f.branch ? ' - ' + f.branch : '')} />
            </div>}
        </div>

        <div className="card">
          <h3><i className="fas fa-location-crosshairs"></i> Location</h3>

          <div className="field">
            <label>Current Location <span className="req">*</span></label>
            <div className={'loc-summary' + (f.cur ? ' done' : '')}>
              {f.cur
                ? <React.Fragment>
                    <div className="addr">
                      <i className="fas fa-map-marker-alt" style={{ color: '#2ecc71' }}></i> {f.cur.address}
                    </div>
                    <div className="coords">
                      {f.cur.lat.toFixed(6)}, {f.cur.lng.toFixed(6)}
                      {f.cur.accuracy ? '  +/-' + f.cur.accuracy + 'm' : ''}
                    </div>
                    <button className="btn btn-soft btn-sm" style={{ marginTop: 10 }}
                            onClick={() => setPicker('current')}>
                      <i className="fas fa-pen"></i> Change location
                    </button>
                  </React.Fragment>
                : <button className="btn btn-primary btn-block" onClick={() => setPicker('current')}>
                    <i className="fas fa-location-arrow"></i> Set current location
                  </button>}
            </div>
            <p className="hint">Opens a map like WhatsApp - it auto-detects your GPS, and you can drag
              the map to fine-tune the pin or search for a landmark.</p>
          </div>

          <div className="field">
            <label>Home Location <span style={{ color: '#6b7c93', fontWeight: 600 }}>(one time)</span></label>
            <div className={'loc-summary' + (f.home ? ' done' : '')}>
              {f.home
                ? <React.Fragment>
                    <div className="addr">
                      <i className="fas fa-house" style={{ color: '#2ecc71' }}></i> {f.home.address}
                    </div>
                    <div className="coords">
                      {Number(f.home.lat).toFixed(6)}, {Number(f.home.lng).toFixed(6)}
                    </div>
                    <button className="btn btn-soft btn-sm" style={{ marginTop: 10 }}
                            onClick={() => setPicker('home')}>
                      <i className="fas fa-pen"></i> Update home
                    </button>
                  </React.Fragment>
                : <button className="btn btn-outline btn-block" onClick={() => setPicker('home')}>
                    <i className="fas fa-house-chimney"></i> Set home location
                  </button>}
            </div>
            <p className="hint">Saved against your name so the manager can see your base area.</p>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Remarks <span style={{ color: '#6b7c93', fontWeight: 600 }}>(optional)</span></label>
            <textarea className="inp" value={f.notes} placeholder="Visit purpose, hospital / garage name, etc."
                      onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="sticky-submit">
        <div className="inner">
          <button className="btn btn-primary btn-block" disabled={saving} onClick={submit}>
            {saving
              ? <React.Fragment><i className="fas fa-spinner fa-spin"></i> Submitting...</React.Fragment>
              : <React.Fragment><i className="fas fa-paper-plane"></i> Submit My Location</React.Fragment>}
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

/* ---------------------------------------------------------------- Gate */
function Gate({ role, onOk }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  function go() {
    if (!code) return;
    setBusy(true);
    fetch('/api/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pass: code, role: role })
    }).then(r => r.json()).then(r => {
      setBusy(false);
      if (!r.ok) return Swal.fire('Access denied', r.error || 'Wrong passcode.', 'error');
      rememberPass(code);
      onOk();
    }).catch(e => { setBusy(false); Swal.fire('Error', String(e), 'error'); });
  }

  return (
    <div className="wrap">
      <div className="card gate">
        <div className="lock"><i className="fas fa-user-shield"></i></div>
        <h2 style={{ margin: '0 0 6px', color: '#001f3f', fontSize: 19 }}>
          {role === 'admin' ? 'Admin Login' : 'Manager Login'}
        </h2>
        <p className="hint" style={{ marginBottom: 18 }}>Enter your passcode to continue.</p>
        <input className="inp" type="password" value={code} placeholder="Passcode"
               onChange={e => setCode(e.target.value)}
               onKeyDown={e => { if (e.key === 'Enter') go(); }} />
        <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy} onClick={go}>
          {busy
            ? <React.Fragment><i className="fas fa-spinner fa-spin"></i> Checking...</React.Fragment>
            : <React.Fragment><i className="fas fa-arrow-right-to-bracket"></i> Continue</React.Fragment>}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- ManagerDashboard */
function ManagerDashboard() {
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('map');
  const [fCity, setFCity] = useState('');
  const [fOfficer, setFOfficer] = useState('');
  const [fType, setFType] = useState('');
  const [latestOnly, setLatestOnly] = useState(true);
  const [picker, setPicker] = useState(false);
  const [origin, setOrigin] = useState(null);
  const [radius, setRadius] = useState(5);

  const mapRef = useRef(null), mapEl = useRef(null);
  const layerRef = useRef(null), circleRef = useRef(null);
  const tableRef = useRef(null), dtRef = useRef(null);
  const c1 = useRef(null), c2 = useRef(null), ch1 = useRef(null), ch2 = useRef(null);

  const load = useCallback((quiet) => {
    setLoading(true);
    return api('/api/dashboard').then(r => {
      setLoading(false);
      if (!r || !r.ok) { if (!quiet) Swal.fire('Session expired', 'Please log in again.', 'warning'); setAuthed(false); return; }
      setData(r);
      setAuthed(true);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { if (PASS) load(true); }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    let list = data.checkins.slice();
    if (latestOnly) {
      const seen = {};
      list = list.filter(c => { const k = c.mobile || c.name; if (seen[k]) return false; seen[k] = 1; return true; });
    }
    if (fCity) list = list.filter(c => c.city === fCity);
    if (fOfficer) list = list.filter(c => (c.mobile || c.name) === fOfficer);
    if (fType) list = list.filter(c => c.type === fType);
    return list;
  }, [data, latestOnly, fCity, fOfficer, fType]);

  const nearby = useMemo(() => {
    if (!origin) return null;
    return rows.map(c => Object.assign({}, c, { distanceKm: haversine(origin.lat, origin.lng, c.lat, c.lng) }))
               .filter(c => c.distanceKm <= radius)
               .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [origin, radius, rows]);

  const shown = nearby || rows;

  const cityOpts = useMemo(() => {
    if (!data) return [];
    const s = {};
    data.checkins.forEach(c => { if (c.city) s[c.city] = 1; });
    return Object.keys(s).sort().map(c => ({ value: c, label: c }));
  }, [data]);

  const officerOpts = useMemo(() => {
    if (!data) return [];
    const m = {};
    data.checkins.forEach(c => { const k = c.mobile || c.name; if (!m[k]) m[k] = c; });
    return Object.keys(m).map(k => ({ value: k, label: m[k].name, sub: m[k].mobile }))
                 .sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  useEffect(() => {
    if (!authed || tab !== 'map' || !mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current).setView(DEFAULT_CENTER, 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    setTimeout(() => map.invalidateSize(), 300);
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; circleRef.current = null; };
  }, [authed, tab]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layerRef.current) return;
    layerRef.current.clearLayers();
    if (circleRef.current) { map.removeLayer(circleRef.current); circleRef.current = null; }

    const bounds = [];
    shown.forEach(c => {
      const icon = L.divIcon({
        className: '',
        html: '<div style="width:34px;height:34px;border-radius:50% 50% 50% 8px;transform:rotate(45deg);' +
              'background:' + (c.type === 'Home' ? '#ff9f1c' : '#0074D9') + ';border:3px solid #fff;' +
              'box-shadow:0 3px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">' +
              '<i class="fas ' + (c.type === 'Home' ? 'fa-house' : 'fa-user') +
              '" style="transform:rotate(-45deg);color:#fff;font-size:13px"></i></div>',
        iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -32]
      });
      const html = '<div class="pop">' +
        (c.photoKey ? '<img src="' + photoUrl(c.photoKey) + '">' : '') +
        '<b>' + c.name + '</b><p><i class="fas fa-phone"></i> ' + c.mobile +
        (c.designation ? '<br><i class="fas fa-briefcase"></i> ' + c.designation : '') +
        '<br><i class="fas fa-location-dot"></i> ' + (c.address || '') +
        '<br><i class="fas fa-clock"></i> ' + c.tsText +
        (c.distanceKm !== undefined
          ? '<br><b style="color:#0074D9"><i class="fas fa-route"></i> ' + c.distanceKm.toFixed(2) + ' km away</b>'
          : '') +
        '</p><div class="acts"><a href="tel:' + c.mobile + '"><i class="fas fa-phone"></i> Call</a>' +
        '<a href="https://wa.me/91' + c.mobile + '" target="_blank"><i class="fab fa-whatsapp"></i> Chat</a>' +
        '<a href="https://www.google.com/maps/dir/?api=1&destination=' + c.lat + ',' + c.lng +
        '" target="_blank"><i class="fas fa-diamond-turn-right"></i> Route</a></div></div>';

      L.marker([c.lat, c.lng], { icon: icon }).bindPopup(html).addTo(layerRef.current);
      bounds.push([c.lat, c.lng]);
    });

    if (origin) {
      circleRef.current = L.circle([origin.lat, origin.lng], {
        radius: radius * 1000, color: '#0074D9', weight: 2, fillColor: '#0074D9', fillOpacity: .08
      }).addTo(map);
      L.marker([origin.lat, origin.lng], {
        icon: L.divIcon({
          className: '',
          html: '<div style="width:20px;height:20px;border-radius:50%;background:#e74c3c;' +
                'border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>',
          iconSize: [20, 20], iconAnchor: [10, 10]
        })
      }).bindPopup('<b>Search point</b><br>' + (origin.address || '')).addTo(layerRef.current);
      map.fitBounds(circleRef.current.getBounds(), { padding: [30, 30] });
    } else if (bounds.length) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [shown, origin, radius, tab, authed]);

  useEffect(() => {
    if (!authed || tab !== 'table' || !tableRef.current) return;
    if (dtRef.current) { dtRef.current.destroy(); dtRef.current = null; }
    dtRef.current = $(tableRef.current).DataTable({
      data: shown.map(c => [
        c.tsText, c.name, c.mobile, c.designation || '-', c.city || '-', c.address || '-', c.type,
        c.distanceKm !== undefined ? c.distanceKm.toFixed(2) + ' km' : '-',
        c.lat.toFixed(6) + ', ' + c.lng.toFixed(6)
      ]),
      columns: [{ title: 'Date & Time' }, { title: 'Officer' }, { title: 'Mobile' },
                { title: 'Designation' }, { title: 'City' }, { title: 'Address' },
                { title: 'Type' }, { title: 'Distance' }, { title: 'Coordinates' }],
      pageLength: 25, order: [[0, 'desc']], scrollX: true, dom: 'Bfrtip',
      buttons: [
        { extend: 'excelHtml5', text: 'Excel', title: 'Field Officer Locations' },
        { extend: 'csvHtml5', text: 'CSV', title: 'Field Officer Locations' },
        { extend: 'copyHtml5', text: 'Copy' }
      ]
    });
    return () => { if (dtRef.current) { dtRef.current.destroy(); dtRef.current = null; } };
  }, [shown, tab, authed]);

  useEffect(() => {
    if (!authed || tab !== 'charts') return;
    const byCity = {};
    shown.forEach(c => { const k = c.city || 'Unknown'; byCity[k] = (byCity[k] || 0) + 1; });
    const cityPairs = Object.keys(byCity).map(k => [k, byCity[k]])
                            .sort((a, b) => b[1] - a[1]).slice(0, 12);
    const byDate = {};
    (data ? data.checkins : []).forEach(c => { byDate[c.dateKey] = (byDate[c.dateKey] || 0) + 1; });
    const datePairs = Object.keys(byDate).sort().slice(-30).map(k => [k, byDate[k]]);

    if (ch1.current) ch1.current.destroy();
    if (ch2.current) ch2.current.destroy();

    if (c1.current) ch1.current = new Chart(c1.current, {
      type: 'bar',
      data: { labels: cityPairs.map(p => p[0]),
              datasets: [{ label: 'Officers', data: cityPairs.map(p => p[1]),
                           backgroundColor: '#0074D9', borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false,
                 plugins: { legend: { display: false } },
                 scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });

    if (c2.current) ch2.current = new Chart(c2.current, {
      type: 'line',
      data: { labels: datePairs.map(p => p[0]),
              datasets: [{ label: 'Check-ins', data: datePairs.map(p => p[1]),
                           borderColor: '#001f3f', backgroundColor: 'rgba(0,116,217,.16)',
                           fill: true, tension: .35, pointRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: false,
                 scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });

    return () => { if (ch1.current) ch1.current.destroy(); if (ch2.current) ch2.current.destroy(); };
  }, [shown, tab, authed, data]);

  if (!authed || !data) return <Gate role="manager" onOk={() => load(false)} />;

  const uniqueOfficers = Object.keys(rows.reduce((m, c) => { m[c.mobile || c.name] = 1; return m; }, {})).length;
  const todayKey = new Date().toLocaleDateString('en-CA');
  const todayCount = data.checkins.filter(c => c.dateKey === todayKey).length;

  return (
    <React.Fragment>
      {picker &&
        <LocationPicker title="Search near this location" initial={origin}
                        onCancel={() => setPicker(false)}
                        onConfirm={loc => { setOrigin(loc); setPicker(false); }} />}

      <div className="wrap-wide">
        <div className="kpis">
          <div className="kpi"><i className="fas fa-users"></i>
            <div className="n">{uniqueOfficers}</div><div className="l">Officers shown</div></div>
          <div className="kpi"><i className="fas fa-map-location-dot"></i>
            <div className="n">{data.checkins.length}</div><div className="l">Total check-ins</div></div>
          <div className="kpi"><i className="fas fa-calendar-day"></i>
            <div className="n">{todayCount}</div><div className="l">Today</div></div>
          <div className="kpi" style={{ borderLeftColor: origin ? '#2ecc71' : '#e3e9f0' }}>
            <i className="fas fa-location-crosshairs"></i>
            <div className="n">{nearby ? nearby.length : '-'}</div>
            <div className="l">Within {radius} km</div></div>
        </div>

        <div className="card">
          <h3><i className="fas fa-magnifying-glass-location"></i> Search Officers Near a Location</h3>
          <div className="grid3">
            <div className="field">
              <label>Search Point</label>
              <div className={'loc-summary' + (origin ? ' done' : '')}>
                {origin
                  ? <React.Fragment>
                      <div className="addr">
                        <i className="fas fa-crosshairs" style={{ color: '#2ecc71' }}></i> {origin.address}
                      </div>
                      <div className="coords">{origin.lat.toFixed(6)}, {origin.lng.toFixed(6)}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button className="btn btn-soft btn-sm" onClick={() => setPicker(true)}>
                          <i className="fas fa-pen"></i> Change</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setOrigin(null)}>
                          <i className="fas fa-times"></i> Clear</button>
                      </div>
                    </React.Fragment>
                  : <button className="btn btn-primary btn-block" onClick={() => setPicker(true)}>
                      <i className="fas fa-map-location-dot"></i> Pick / search a location
                    </button>}
              </div>
            </div>

            <div>
              <div className="field">
                <label>Radius - {radius} km</label>
                <input className="slider" type="range" min="1" max="100" step="1" value={radius}
                       onChange={e => setRadius(Number(e.target.value))} />
                <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
                  {[2, 5, 10, 25, 50].map(r =>
                    <button key={r} className={'btn btn-sm ' + (radius === r ? 'btn-primary' : 'btn-ghost')}
                            onClick={() => setRadius(r)}>{r} km</button>)}
                </div>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Show</label>
                <SearchableDropdown icon="fa-layer-group" allowClear={false}
                  options={[{ value: 'latest', label: 'Latest location per officer' },
                            { value: 'all', label: 'All check-in history' }]}
                  value={latestOnly ? 'latest' : 'all'}
                  onChange={v => setLatestOnly(v === 'latest')} />
              </div>
            </div>

            <div>
              <div className="field">
                <label>Filter by City</label>
                <SearchableDropdown options={cityOpts} value={fCity} onChange={setFCity}
                                    icon="fa-city" placeholder="All cities" />
              </div>
              <div className="field">
                <label>Filter by Officer</label>
                <SearchableDropdown options={officerOpts} value={fOfficer} onChange={setFOfficer}
                                    icon="fa-user" placeholder="All officers" />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Location Type</label>
                <SearchableDropdown icon="fa-tag" placeholder="All types"
                  options={[{ value: 'Current', label: 'Current location' },
                            { value: 'Home', label: 'Home location' }]}
                  value={fType} onChange={setFType} />
              </div>
            </div>
          </div>
        </div>

        <div className="tabs">
          {[['map', 'fa-map', 'Map'], ['list', 'fa-list-ul', 'Nearby List'],
            ['table', 'fa-table', 'Full Table'], ['charts', 'fa-chart-column', 'Analytics']].map(t =>
            <div key={t[0]} className={'tab' + (tab === t[0] ? ' on' : '')} onClick={() => setTab(t[0])}>
              <i className={'fas ' + t[1]}></i> {t[2]}
            </div>)}
          <div style={{ flex: 1 }}></div>
          <div className="tab" onClick={() => load(false)}>
            <i className={'fas fa-rotate' + (loading ? ' fa-spin' : '')}></i> Refresh
          </div>
        </div>

        {tab === 'map' &&
          <div className="grid2">
            <div className="card"><div className="mgr-map" ref={mapEl}></div></div>
            <div className="card">
              <h3><i className="fas fa-users-viewfinder"></i>
                {origin ? ' Officers within ' + radius + ' km' : ' All officers on map'}
                <span style={{ marginLeft: 'auto', background: '#e8f2fb', color: '#001f3f',
                               padding: '4px 11px', borderRadius: 20, fontSize: 12 }}>{shown.length}</span>
              </h3>
              <div className="near-list">
                {shown.length === 0 && <div className="sd-empty">No officers match the current filters.</div>}
                {shown.map(c =>
                  <div key={c.id} className="near-item"
                       onClick={() => { if (mapRef.current) mapRef.current.setView([c.lat, c.lng], 16); }}>
                    <img src={photoUrl(c.photoKey) || avatarFallback(c.name)} alt=""
                         onError={e => { e.target.src = avatarFallback(c.name); }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="nm">{c.name}{' '}
                        <span className={'pill ' + (c.type === 'Home' ? 'pill-home' : 'pill-cur')}>{c.type}</span>
                      </div>
                      <div className="mt"><i className="fas fa-phone"></i> {c.mobile}</div>
                      <div className="mt" style={{ overflow: 'hidden', textOverflow: 'ellipsis',
                                                   whiteSpace: 'nowrap' }}>
                        <i className="fas fa-location-dot"></i> {c.address}</div>
                      <div className="mt"><i className="fas fa-clock"></i> {c.tsText}</div>
                    </div>
                    {c.distanceKm !== undefined &&
                      <div className="km"><b>{c.distanceKm.toFixed(2)}</b><small>KM AWAY</small></div>}
                  </div>)}
              </div>
            </div>
          </div>}

        {tab === 'list' &&
          <div className="card">
            <h3><i className="fas fa-list-ul"></i> {origin ? 'Nearest first' : 'Most recent first'}</h3>
            <div className="grid3">
              {shown.map(c =>
                <div key={c.id} className="near-item" style={{ marginBottom: 0 }}>
                  <img src={photoUrl(c.photoKey) || avatarFallback(c.name)} alt=""
                       onError={e => { e.target.src = avatarFallback(c.name); }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="nm">{c.name}</div>
                    <div className="mt"><i className="fas fa-phone"></i> {c.mobile}</div>
                    <div className="mt">{c.address}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <a className="btn btn-soft btn-sm" href={'tel:' + c.mobile}>
                        <i className="fas fa-phone"></i></a>
                      <a className="btn btn-soft btn-sm" target="_blank" href={'https://wa.me/91' + c.mobile}>
                        <i className="fab fa-whatsapp"></i></a>
                      <a className="btn btn-soft btn-sm" target="_blank"
                         href={'https://www.google.com/maps/dir/?api=1&destination=' + c.lat + ',' + c.lng}>
                        <i className="fas fa-diamond-turn-right"></i></a>
                    </div>
                  </div>
                  {c.distanceKm !== undefined &&
                    <div className="km"><b>{c.distanceKm.toFixed(2)}</b><small>KM</small></div>}
                </div>)}
              {shown.length === 0 && <div className="sd-empty">Nothing to show.</div>}
            </div>
          </div>}

        {tab === 'table' &&
          <div className="card">
            <h3><i className="fas fa-table"></i> Check-in Records</h3>
            <table ref={tableRef} className="display" style={{ width: '100%' }}></table>
          </div>}

        {tab === 'charts' &&
          <div className="grid2">
            <div className="card">
              <h3><i className="fas fa-city"></i> Officers by City</h3>
              <div style={{ height: 320 }}><canvas ref={c1}></canvas></div>
            </div>
            <div className="card">
              <h3><i className="fas fa-chart-line"></i> Check-ins Trend (last 30 days)</h3>
              <div style={{ height: 320 }}><canvas ref={c2}></canvas></div>
            </div>
          </div>}
      </div>
    </React.Fragment>
  );
}

/* ---------------------------------------------------------------- Admin */
function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',' || ch === '\\t') { row.push(cur); cur = ''; }
    else if (ch === '\\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [csv, setCsv] = useState('');
  const [nf, setNf] = useState({ name: '', mobile: '', designation: '', branch: '' });

  const load = useCallback(() => {
    setLoading(true);
    return api('/api/admin/officers').then(r => {
      setLoading(false);
      if (!r || !r.ok) { setAuthed(false); return; }
      setList(r.officers || []);
      setAuthed(true);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { if (PASS) load(); }, []);

  function addOne() {
    if (!nf.name.trim() || nf.mobile.replace(/\\D/g, '').length !== 10)
      return Swal.fire('Check details', 'Name and a valid 10-digit mobile are required.', 'warning');
    api('/api/admin/officers', { method: 'POST', body: { officers: [nf] } }).then(r => {
      if (!r.ok) return Swal.fire('Failed', r.error || 'Error', 'error');
      setNf({ name: '', mobile: '', designation: '', branch: '' });
      Swal.fire({ icon: 'success', title: 'Officer saved', timer: 1100, showConfirmButton: false });
      load();
    });
  }

  function importCsv() {
    const rows = parseCSV(csv.trim());
    if (rows.length < 2) return Swal.fire('Nothing to import', 'Paste a header row plus data rows.', 'warning');

    const head = rows[0].map(h => String(h).toLowerCase().replace(/[^a-z]/g, ''));
    const idx = names => { for (const n of names) { const i = head.indexOf(n); if (i > -1) return i; } return -1; };
    const iName = idx(['name', 'officername', 'fieldofficer', 'employeename']);
    const iMob  = idx(['mobile', 'mobileno', 'phone', 'phoneno', 'contact', 'contactno']);
    const iDes  = idx(['designation', 'role', 'position']);
    const iBr   = idx(['branch', 'location', 'region', 'zone', 'city']);

    if (iName < 0 || iMob < 0)
      return Swal.fire('Columns not found',
        'Your header row needs a <b>Name</b> column and a <b>Mobile</b> column.', 'error');

    const officers = rows.slice(1).map(r => ({
      name: (r[iName] || '').trim(),
      mobile: (r[iMob] || '').trim(),
      designation: iDes > -1 ? (r[iDes] || '').trim() : '',
      branch: iBr > -1 ? (r[iBr] || '').trim() : ''
    })).filter(o => o.name);

    if (!officers.length) return Swal.fire('Nothing to import', 'No valid rows found.', 'warning');

    api('/api/admin/officers', { method: 'POST', body: { officers: officers } }).then(r => {
      if (!r.ok) return Swal.fire('Failed', r.error || 'Error', 'error');
      Swal.fire('Import done', 'Saved: <b>' + r.saved + '</b><br>Skipped (bad name/mobile): <b>' +
                r.skipped + '</b>', 'success');
      setCsv('');
      load();
    });
  }

  function toggle(o) {
    api('/api/admin/officer/toggle', { method: 'POST', body: { id: o.id, active: o.active ? 0 : 1 } })
      .then(load);
  }

  function del(o) {
    Swal.fire({
      title: 'Delete ' + o.name + '?', text: 'Their past check-ins stay in the records.',
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#e74c3c',
      confirmButtonText: 'Delete'
    }).then(res => {
      if (!res.isConfirmed) return;
      api('/api/admin/officer/delete', { method: 'POST', body: { id: o.id } }).then(load);
    });
  }

  if (!authed) return <Gate role="admin" onOk={load} />;

  return (
    <div className="wrap-wide">
      <div className="grid2">
        <div className="card">
          <h3><i className="fas fa-file-import"></i> Bulk Import from your existing list</h3>
          <p className="hint" style={{ marginBottom: 10 }}>
            Open your current officer sheet, select the cells including the header row, copy, and paste
            below. Header must contain <b>Name</b> and <b>Mobile</b>; <b>Designation</b> and
            <b> Branch</b> are optional.
          </p>
          <textarea className="inp" style={{ minHeight: 200, fontFamily: 'monospace', fontSize: 13 }}
                    value={csv} placeholder={'Name,Mobile,Designation,Branch\\nRamesh Kumar,9876543210,Surveyor,Chennai'}
                    onChange={e => setCsv(e.target.value)} />
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={importCsv}>
            <i className="fas fa-upload"></i> Import officers
          </button>
        </div>

        <div className="card">
          <h3><i className="fas fa-user-plus"></i> Add a single officer</h3>
          <div className="field"><label>Name <span className="req">*</span></label>
            <input className="inp" value={nf.name}
                   onChange={e => setNf(Object.assign({}, nf, { name: e.target.value }))} /></div>
          <div className="field"><label>Mobile <span className="req">*</span></label>
            <input className="inp" type="tel" maxLength="10" value={nf.mobile}
                   onChange={e => setNf(Object.assign({}, nf,
                     { mobile: e.target.value.replace(/\\D/g, '').slice(0, 10) }))} /></div>
          <div className="field"><label>Designation</label>
            <input className="inp" value={nf.designation}
                   onChange={e => setNf(Object.assign({}, nf, { designation: e.target.value }))} /></div>
          <div className="field"><label>Branch</label>
            <input className="inp" value={nf.branch}
                   onChange={e => setNf(Object.assign({}, nf, { branch: e.target.value }))} /></div>
          <button className="btn btn-primary btn-block" onClick={addOne}>
            <i className="fas fa-plus"></i> Save officer
          </button>
        </div>
      </div>

      <div className="card">
        <h3><i className="fas fa-users"></i> Officer Master List
          <span style={{ marginLeft: 'auto', background: '#e8f2fb', color: '#001f3f',
                         padding: '4px 11px', borderRadius: 20, fontSize: 12 }}>{list.length}</span>
        </h3>
        {loading && <div className="loading"><div className="spin"></div>Loading...</div>}
        {!loading &&
          <div style={{ overflowX: 'auto' }}>
            <table className="otab">
              <thead><tr>
                <th>Name</th><th>Mobile</th><th>Designation</th><th>Branch</th>
                <th>Home Location</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {list.length === 0 &&
                  <tr><td colSpan="7" style={{ textAlign: 'center', color: '#6b7c93', padding: 26 }}>
                    No officers yet. Import your list above.</td></tr>}
                {list.map(o =>
                  <tr key={o.id}>
                    <td><b>{o.name}</b></td>
                    <td>{o.mobile}</td>
                    <td>{o.designation || '-'}</td>
                    <td>{o.branch || '-'}</td>
                    <td style={{ maxWidth: 260, fontSize: 12, color: '#6b7c93' }}>
                      {o.home_address || '-'}</td>
                    <td>
                      <span className={'pill ' + (o.active ? 'pill-cur' : 'pill-home')}>
                        {o.active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(o)}>
                        {o.active ? 'Disable' : 'Enable'}</button>{' '}
                      <button className="btn btn-danger btn-sm" onClick={() => del(o)}>
                        <i className="fas fa-trash"></i></button>
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Shell */
function App() {
  const v = BOOT.view;
  const titles = {
    officer: ['Field Officer Check-In', 'Share your photo, details & location', 'fa-location-dot', 'Officer'],
    manager: ['Field Officer Location Dashboard', 'Manager view', 'fa-chart-line', 'Manager'],
    admin:   ['Officer Master List', 'Admin view', 'fa-users-gear', 'Admin']
  };
  const t = titles[v] || titles.officer;

  return (
    <React.Fragment>
      <div className="appbar">
        <div className="row">
          <div className="logo"><i className={'fas ' + t[2]}></i></div>
          <div>
            <h1>{t[0]}</h1>
            <p>{BOOT.orgName} - {t[1]}</p>
          </div>
          <div className="spacer"></div>
          <div className="badge-lite"><i className="fas fa-user-shield"></i> {t[3]}</div>
        </div>
      </div>
      {v === 'manager' ? <ManagerDashboard /> : v === 'admin' ? <AdminPage /> : <OfficerForm />}
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
`;
