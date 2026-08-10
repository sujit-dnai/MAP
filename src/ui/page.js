import { CSS } from './styles.js';
import { CLIENT_JS } from './client.js';

export const APP_NAME = 'Field Officer Location Tracker';

const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js',
  'https://cdn.datatables.net/1.13.7/js/jquery.dataTables.min.js',
  'https://cdn.datatables.net/buttons/2.4.2/js/dataTables.buttons.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.datatables.net/buttons/2.4.2/js/buttons.html5.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11.10.1/dist/sweetalert2.all.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

const STYLESHEETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdn.datatables.net/1.13.7/css/jquery.dataTables.min.css',
  'https://cdn.datatables.net/buttons/2.4.2/css/buttons.dataTables.min.css'
];

/**
 * Render the single-page app.
 * @param {'officer'|'manager'|'admin'} view
 * @param {object} env  Worker environment bindings
 */
export function page(view, env) {
  const boot = JSON.stringify({
    view,
    appName: APP_NAME,
    orgName: (env && env.ORG_NAME) || 'Field Operations'
  });

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">',
    '<title>' + APP_NAME + '</title>',
    STYLESHEETS.map(h => '<link rel="stylesheet" href="' + h + '">').join(''),
    '<style>' + CSS + '</style>',
    '</head>',
    '<body>',
    '<div id="root"></div>',
    '<script>var BOOT = ' + boot + ';<' + '/script>',
    CDN.map(s => '<script src="' + s + '"><' + '/script>').join(''),
    '<script type="text/babel" data-presets="react">' + CLIENT_JS + '<' + '/script>',
    '</body>',
    '</html>'
  ].join('\n');
}
