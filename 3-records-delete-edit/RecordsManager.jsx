/* =====================================================================
   RecordsManager — manage individual check-in / location records
   Drop-in card for the SKD Health Manager/Admin dashboard.

   Gives each check-in three actions that DON'T exist today:
       • Delete this record
       • Move location ONLY   (reuses your existing <LocationPicker/>)
       • Change date / time
   plus a date + officer filter so you can find the record fast.

   REUSES globals already in your <script type="text/babel"> block:
       api(), LocationPicker, photoUrl(), avatarFallback(), Swal
   DATA it reads:  GET /api/dashboard -> { ok, checkins:[ {id,name,mobile,
       designation,address,city,state,lat,lng,photoKey,ts,tsText,dateKey} ] }

   NEEDS 3 NEW BACKEND ROUTES (see RecordsManager.backend.js):
       POST /api/admin/checkin/delete    { id }
       POST /api/admin/checkin/relocate  { id, lat, lng, address, city, state }
       POST /api/admin/checkin/redate    { id, ts, dateKey, tsText }

   INSTALL
   -------
   1. Paste this function into your <script type="text/babel"> block,
      above  function AdminPage()  (or ManagerDashboard).
   2. Render  <RecordsManager />  wherever you want it — a natural home is
      a new "Records" tab, or just drop it at the bottom of AdminPage.
   3. Add the 3 backend routes, then redeploy.
   ===================================================================== */

function RecordsManager() {
  const { useState, useEffect, useMemo, useCallback } = React;

  const [rows, setRows]     = useState(null);   // all checkins
  const [loading, setLoad]  = useState(true);
  const [fDate, setFDate]   = useState('');      // 'YYYY-MM-DD' or ''
  const [fOff, setFOff]     = useState('');      // mobile||name or ''
  const [qText, setQText]   = useState('');
  const [picker, setPicker] = useState(null);    // record being relocated

  const load = useCallback(() => {
    setLoad(true);
    return api('/api/dashboard').then(r => {
      setLoad(false);
      if (!r || !r.ok) { Swal.fire('Session expired', 'Please log in again.', 'warning'); return; }
      setRows((r.checkins || []).slice());
    }).catch(() => setLoad(false));
  }, []);
  useEffect(() => { load(); }, []);

  /* officer dropdown options */
  const offOpts = useMemo(() => {
    if (!rows) return [];
    const m = {};
    rows.forEach(c => { const k = c.mobile || c.name; if (!m[k]) m[k] = c.name; });
    return Object.keys(m).map(k => ({ value: k, label: m[k] })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const shown = useMemo(() => {
    if (!rows) return [];
    let list = rows;
    if (fDate) list = list.filter(c => c.dateKey === fDate);
    if (fOff)  list = list.filter(c => (c.mobile || c.name) === fOff);
    if (qText) {
      const q = qText.toLowerCase();
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.mobile || '').includes(q) ||
        (c.address || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q));
    }
    return list;
  }, [rows, fDate, fOff, qText]);

  /* -------- format a Date the same way your app shows tsText -------- */
  function fmtTs(d) {
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let h = d.getHours(); const ap = h < 12 ? 'am' : 'pm';
    h = h % 12; if (h === 0) h = 12;
    const mm = String(d.getMinutes()).padStart(2, '0');
    return d.getDate() + ' ' + mon[d.getMonth()] + ' ' + d.getFullYear() +
           ', ' + String(h).padStart(2, '0') + ':' + mm + ' ' + ap;
  }
  function dateKeyOf(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /* value for <input type=datetime-local> from a ts (ms) */
  function toLocalInput(ts) {
    const d = new Date(ts || Date.now());
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ------------------------------ DELETE ------------------------------ */
  function del(c) {
    Swal.fire({
      title: 'Delete this check-in?',
      html: '<b>' + c.name + '</b><br>' + (c.tsText || '') + '<br><span style="color:#6b7c93">' + (c.address || '') + '</span>',
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#e74c3c', confirmButtonText: 'Delete record',
    }).then(res => {
      if (!res.isConfirmed) return;
      api('/api/admin/checkin/delete', { method: 'POST', body: { id: c.id } }).then(r => {
        if (!r || !r.ok) return Swal.fire('Failed', (r && r.error) || 'Could not delete.', 'error');
        setRows(p => p.filter(x => x.id !== c.id));
        Swal.fire({ icon: 'success', title: 'Record deleted', timer: 1000, showConfirmButton: false });
      });
    });
  }

  /* --------------------------- CHANGE DATE ---------------------------- */
  function redate(c) {
    Swal.fire({
      title: 'Change date & time',
      html: '<div style="text-align:left;font-size:13px;color:#33475b;margin-bottom:6px">' + c.name + '</div>' +
            '<input id="rm-dt" type="datetime-local" class="swal2-input" value="' + toLocalInput(c.ts) + '" style="width:auto">',
      showCancelButton: true, confirmButtonText: 'Save date',
      preConfirm: () => {
        const v = document.getElementById('rm-dt').value;
        if (!v) { Swal.showValidationMessage('Pick a date & time'); return false; }
        return v;
      },
    }).then(res => {
      if (!res.isConfirmed) return;
      const d = new Date(res.value);
      const payload = { id: c.id, ts: d.getTime(), dateKey: dateKeyOf(d), tsText: fmtTs(d) };
      api('/api/admin/checkin/redate', { method: 'POST', body: payload }).then(r => {
        if (!r || !r.ok) return Swal.fire('Failed', (r && r.error) || 'Could not update.', 'error');
        setRows(p => p.map(x => x.id === c.id ? Object.assign({}, x, payload) : x));
        Swal.fire({ icon: 'success', title: 'Date updated', timer: 1000, showConfirmButton: false });
      });
    });
  }

  /* ------------------------- MOVE LOCATION ONLY ----------------------- */
  function saveLocation(loc) {
    const c = picker;
    const payload = {
      id: c.id, lat: loc.lat, lng: loc.lng,
      address: loc.address || '', city: loc.city || '', state: loc.state || '',
    };
    api('/api/admin/checkin/relocate', { method: 'POST', body: payload }).then(r => {
      setPicker(null);
      if (!r || !r.ok) return Swal.fire('Failed', (r && r.error) || 'Could not move location.', 'error');
      setRows(p => p.map(x => x.id === c.id ? Object.assign({}, x, payload) : x));
      Swal.fire({ icon: 'success', title: 'Location updated', timer: 1000, showConfirmButton: false });
    });
  }

  return (
    <React.Fragment>
      {picker && (
        <LocationPicker
          title={'Move location — ' + picker.name}
          initial={{ lat: picker.lat, lng: picker.lng }}
          onCancel={() => setPicker(null)}
          onConfirm={saveLocation}
        />
      )}

      <div className="card">
        <h3><i className="fas fa-clipboard-list" style={{ color: '#0074D9' }}></i> Manage Check-in Records</h3>

        {/* filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                 style={{ padding: '9px 12px', border: '1px solid #cfd8e3', borderRadius: 8 }} />
          <select value={fOff} onChange={e => setFOff(e.target.value)}
                  style={{ padding: '9px 12px', border: '1px solid #cfd8e3', borderRadius: 8, minWidth: 170 }}>
            <option value="">All officers</option>
            {offOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input value={qText} onChange={e => setQText(e.target.value)} placeholder="Search name / mobile / place"
                 style={{ flex: '1 1 200px', minWidth: 180, padding: '9px 12px', border: '1px solid #cfd8e3', borderRadius: 8 }} />
          {(fDate || fOff || qText) && (
            <button className="btn btn-soft btn-sm" onClick={() => { setFDate(''); setFOff(''); setQText(''); }}>
              <i className="fas fa-xmark"></i> Clear
            </button>
          )}
          <button className="btn btn-soft btn-sm" onClick={load}><i className="fas fa-rotate"></i> Refresh</button>
        </div>

        <div style={{ fontSize: 12, color: '#6b7c93', marginBottom: 8 }}>
          {loading ? 'Loading…' : shown.length + ' record' + (shown.length === 1 ? '' : 's')}
        </div>

        {/* list */}
        <div className="grid3">
          {shown.map(c => (
            <div key={c.id} className="near-item" style={{ marginBottom: 0, alignItems: 'flex-start' }}>
              <img src={photoUrl(c.photoKey) || avatarFallback(c.name)} alt=""
                   onError={e => { e.target.src = avatarFallback(c.name); }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="nm">{c.name}</div>
                <div className="mt"><i className="fas fa-phone"></i> {c.mobile}</div>
                <div className="mt"><i className="fas fa-clock"></i> {c.tsText}</div>
                {c.address && <div className="mt"><i className="fas fa-location-dot"></i> {c.address}</div>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  <button className="btn btn-soft btn-sm" onClick={() => setPicker(c)}>
                    <i className="fas fa-map-location-dot"></i> Move location
                  </button>
                  <button className="btn btn-soft btn-sm" onClick={() => redate(c)}>
                    <i className="fas fa-calendar-day"></i> Change date
                  </button>
                  <button className="btn btn-sm" onClick={() => del(c)}
                          style={{ background: '#fdecea', color: '#c0392b', border: '1px solid #f5c6c0' }}>
                    <i className="fas fa-trash"></i> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!loading && shown.length === 0 && <div className="sd-empty">No records match.</div>}
        </div>
      </div>
    </React.Fragment>
  );
}
