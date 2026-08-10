/**
 * All app styling. Navy gradient header (#001f3f -> #0074D9), Font Awesome icons.
 * Kept as one string so the whole UI ships in a single Worker response.
 */
export const CSS = `
:root{--navy:#001f3f;--blue:#0074D9;--sky:#e8f2fb;--ink:#12263f;--muted:#6b7c93;
--line:#e3e9f0;--ok:#2ecc71;--warn:#ff9f1c;--danger:#e74c3c;--radius:14px;
--shadow:0 4px 18px rgba(0,31,63,.10)}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0;background:#f4f7fb;color:var(--ink);
font-family:'Segoe UI',Roboto,-apple-system,Helvetica,Arial,sans-serif}
a{color:var(--blue);text-decoration:none}
.appbar{background:linear-gradient(135deg,var(--navy) 0%,var(--blue) 100%);color:#fff;
padding:16px 18px;box-shadow:var(--shadow);position:sticky;top:0;z-index:900}
.appbar .row{display:flex;align-items:center;gap:12px;max-width:1500px;margin:0 auto}
.appbar h1{font-size:18px;margin:0;font-weight:700;letter-spacing:.3px}
.appbar p{margin:2px 0 0;font-size:12px;opacity:.85}
.appbar .logo{width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.18);
display:flex;align-items:center;justify-content:center;font-size:19px;flex:0 0 auto}
.appbar .spacer{flex:1}
.badge-lite{background:rgba(255,255,255,.16);padding:6px 12px;border-radius:20px;font-size:12px}
.wrap{max-width:560px;margin:0 auto;padding:16px 14px 90px}
.wrap-wide{max-width:1500px;margin:0 auto;padding:16px 14px 60px}
.card{background:#fff;border-radius:var(--radius);box-shadow:var(--shadow);
padding:18px;margin-bottom:16px;border:1px solid var(--line)}
.card h3{margin:0 0 14px;font-size:15px;color:var(--navy);display:flex;align-items:center;gap:9px}
.card h3 i{color:var(--blue)}
.hint{font-size:12px;color:var(--muted);margin:6px 0 0;line-height:1.5}
.field{margin-bottom:15px}
.field label{display:block;font-size:12.5px;font-weight:700;color:var(--navy);
margin-bottom:6px;text-transform:uppercase;letter-spacing:.4px}
.field label .req{color:var(--danger)}
.inp{width:100%;padding:12px 14px;border:1.6px solid var(--line);border-radius:11px;
font-size:15px;outline:none;background:#fff;transition:.15s;font-family:inherit}
.inp:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(0,116,217,.12)}
.inp[readonly]{background:#f7f9fc;color:var(--muted)}
textarea.inp{resize:vertical;min-height:66px}
.btn{border:0;border-radius:11px;padding:13px 18px;font-size:15px;font-weight:700;cursor:pointer;
display:inline-flex;align-items:center;justify-content:center;gap:9px;font-family:inherit;transition:.15s}
.btn:active{transform:scale(.985)}
.btn:disabled{opacity:.55;cursor:not-allowed}
.btn-primary{background:linear-gradient(135deg,var(--navy),var(--blue));color:#fff}
.btn-outline{background:#fff;color:var(--blue);border:1.6px solid var(--blue)}
.btn-soft{background:var(--sky);color:var(--navy)}
.btn-ghost{background:#f1f5f9;color:var(--ink)}
.btn-danger{background:#fdecea;color:#c0392b}
.btn-block{width:100%}
.btn-sm{padding:8px 13px;font-size:13px;border-radius:9px}
.photo-box{border:2px dashed var(--line);border-radius:var(--radius);padding:18px;
text-align:center;background:#fbfdff;cursor:pointer}
.photo-box.filled{border-style:solid;border-color:var(--ok);background:#f4fdf8}
.photo-prev{width:132px;height:132px;object-fit:cover;border-radius:50%;
border:4px solid #fff;box-shadow:var(--shadow);display:block;margin:0 auto 10px}
.photo-ico{font-size:40px;color:var(--blue);margin-bottom:8px}
.sd{position:relative}
.sd-ctrl{display:flex;align-items:center;gap:9px;padding:12px 14px;border:1.6px solid var(--line);
border-radius:11px;background:#fff;cursor:pointer;font-size:15px;min-height:47px}
.sd-ctrl.open{border-color:var(--blue);box-shadow:0 0 0 3px rgba(0,116,217,.12)}
.sd-ctrl .val{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sd-ctrl .ph{color:#9aa9bd}
.sd-pop{position:absolute;z-index:1200;top:calc(100% + 6px);left:0;right:0;background:#fff;
border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 30px rgba(0,31,63,.18);overflow:hidden}
.sd-search{padding:9px;border-bottom:1px solid var(--line)}
.sd-search input{width:100%;padding:9px 11px;border:1.4px solid var(--line);
border-radius:9px;font-size:14px;outline:none;font-family:inherit}
.sd-list{max-height:250px;overflow-y:auto}
.sd-item{padding:11px 14px;font-size:14.5px;cursor:pointer;border-bottom:1px solid #f3f6fa}
.sd-item:hover,.sd-item.hi{background:var(--sky)}
.sd-item small{display:block;color:var(--muted);font-size:12px;margin-top:2px}
.sd-empty{padding:16px;text-align:center;color:var(--muted);font-size:13.5px}
.loc-summary{border:1.6px solid var(--line);border-radius:12px;padding:13px;background:#fbfdff}
.loc-summary.done{border-color:var(--ok);background:#f4fdf8}
.loc-summary .addr{font-size:14px;line-height:1.5}
.loc-summary .coords{font-size:11.5px;color:var(--muted);margin-top:5px;font-family:monospace}
.lp-overlay{position:fixed;inset:0;background:#fff;z-index:5000;display:flex;flex-direction:column}
.lp-top{background:linear-gradient(135deg,var(--navy),var(--blue));color:#fff;padding:11px 12px;
display:flex;align-items:center;gap:10px}
.lp-top .back{background:rgba(255,255,255,.18);border:0;color:#fff;width:38px;height:38px;
border-radius:50%;font-size:16px;cursor:pointer;flex:0 0 auto}
.lp-top .sbox{flex:1}
.lp-top .sbox input{width:100%;padding:11px 14px;border:0;border-radius:22px;font-size:14.5px;
outline:none;font-family:inherit}
.lp-map-wrap{flex:1;position:relative;min-height:0}
.lp-map{position:absolute;inset:0}
.lp-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);
z-index:600;pointer-events:none;font-size:40px;color:var(--danger);text-shadow:0 4px 10px rgba(0,0,0,.35)}
.lp-shadow{position:absolute;left:50%;top:50%;transform:translate(-50%,-2px);z-index:599;
width:16px;height:6px;border-radius:50%;background:rgba(0,0,0,.28);pointer-events:none}
.lp-gps{position:absolute;right:14px;bottom:16px;z-index:610;width:50px;height:50px;border-radius:50%;
background:#fff;border:0;box-shadow:0 4px 14px rgba(0,0,0,.25);font-size:19px;color:var(--blue);cursor:pointer}
.lp-results{position:absolute;left:0;right:0;top:0;z-index:620;background:#fff;
max-height:60%;overflow-y:auto;box-shadow:0 8px 22px rgba(0,0,0,.18)}
.lp-bottom{background:#fff;border-top:1px solid var(--line);padding:13px 14px 16px;
box-shadow:0 -6px 20px rgba(0,31,63,.08)}
.lp-addr{display:flex;gap:11px;align-items:flex-start;margin-bottom:11px}
.lp-addr .pin{width:38px;height:38px;border-radius:50%;background:var(--sky);color:var(--blue);
display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.lp-addr .txt{flex:1;font-size:13.5px;line-height:1.45}
.lp-addr .txt b{display:block;font-size:14.5px;margin-bottom:2px;color:var(--navy)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:13px;margin-bottom:16px}
.kpi{background:#fff;border-radius:var(--radius);padding:16px;box-shadow:var(--shadow);border-left:4px solid var(--blue)}
.kpi .n{font-size:26px;font-weight:800;color:var(--navy);line-height:1.1}
.kpi .l{font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:5px}
.kpi i{float:right;font-size:21px;color:var(--blue);opacity:.32}
.grid2{display:grid;grid-template-columns:1.35fr 1fr;gap:16px}
.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
@media(max-width:980px){.grid2{grid-template-columns:1fr}}
.mgr-map{height:520px;border-radius:12px;border:1px solid var(--line)}
.near-list{max-height:520px;overflow-y:auto}
.near-item{display:flex;gap:11px;padding:11px;border:1px solid var(--line);border-radius:12px;
margin-bottom:9px;cursor:pointer;transition:.15s;background:#fff}
.near-item:hover{border-color:var(--blue);box-shadow:0 3px 12px rgba(0,116,217,.14)}
.near-item img{width:52px;height:52px;border-radius:50%;object-fit:cover;flex:0 0 auto;background:var(--sky)}
.near-item .nm{font-weight:700;font-size:14.5px;color:var(--navy)}
.near-item .mt{font-size:12.5px;color:var(--muted);margin-top:2px;line-height:1.45}
.near-item .km{margin-left:auto;text-align:right;flex:0 0 auto}
.near-item .km b{display:block;color:var(--blue);font-size:15px}
.near-item .km small{color:var(--muted);font-size:10.5px}
.pill{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
.pill-cur{background:#e8f7ee;color:#1e8e4e}
.pill-home{background:#fff4e0;color:#b26a00}
.slider{width:100%;accent-color:var(--blue)}
table.dataTable{font-size:13px}
table.dataTable thead th{background:var(--navy);color:#fff;border:0}
.dt-buttons .dt-button{background:var(--sky)!important;color:var(--navy)!important;border:0!important;
border-radius:8px!important;font-size:12.5px!important;padding:7px 13px!important;margin-right:6px!important}
.gate{max-width:390px;margin:70px auto;text-align:center}
.gate .lock{width:74px;height:74px;border-radius:50%;background:linear-gradient(135deg,var(--navy),var(--blue));
color:#fff;display:flex;align-items:center;justify-content:center;font-size:29px;margin:0 auto 18px}
.loading{text-align:center;padding:56px 18px;color:var(--muted)}
.spin{width:38px;height:38px;border:3.5px solid var(--sky);border-top-color:var(--blue);
border-radius:50%;animation:sp .8s linear infinite;margin:0 auto 14px}
@keyframes sp{to{transform:rotate(360deg)}}
.tabs{display:flex;gap:7px;margin-bottom:16px;overflow-x:auto;padding-bottom:3px}
.tab{padding:9px 16px;border-radius:22px;background:#fff;border:1.5px solid var(--line);
font-size:13.5px;cursor:pointer;white-space:nowrap;font-weight:600;color:var(--muted)}
.tab.on{background:linear-gradient(135deg,var(--navy),var(--blue));color:#fff;border-color:transparent}
.leaflet-popup-content{margin:11px 13px;font-family:inherit}
.pop{min-width:190px}
.pop img{width:100%;height:118px;object-fit:cover;border-radius:9px;margin-bottom:8px;background:var(--sky)}
.pop b{font-size:14.5px;color:var(--navy)}
.pop p{margin:5px 0;font-size:12.5px;color:var(--muted);line-height:1.45}
.pop .acts{display:flex;gap:7px;margin-top:9px}
.pop .acts a{flex:1;text-align:center;padding:7px;border-radius:8px;background:var(--sky);font-size:12px;font-weight:700}
.sticky-submit{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid var(--line);
padding:11px 14px;box-shadow:0 -5px 18px rgba(0,31,63,.10);z-index:800}
.sticky-submit .inner{max-width:560px;margin:0 auto}
.otab{width:100%;border-collapse:collapse;font-size:13.5px}
.otab th{background:var(--navy);color:#fff;text-align:left;padding:10px;font-size:12px;
text-transform:uppercase;letter-spacing:.4px}
.otab td{padding:10px;border-bottom:1px solid var(--line)}
.otab tr:hover td{background:#fafcff}
`;
