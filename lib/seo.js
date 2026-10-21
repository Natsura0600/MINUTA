const fs = require('fs');
const path = require('path');
const T = require('./tenants');
const { getConfig, isOpen } = require('./config');
const stock = require('./stock');
const redis = require('./redis');
const { siteFor, slugFromReq, rootDomain, hostOf } = require('./http');

// La tienda es una sola página (public/app.html). Acá se le agregan, para cada local, el título, la descripción,
// las etiquetas para compartir en WhatsApp / Instagram y los datos para Google, y el menú ya cargado
// (así la tienda aparece sin esperar una segunda consulta).
let PLANTILLA = null;
const plantilla = () => (PLANTILLA = PLANTILLA || fs.readFileSync(path.join(__dirname, '..', 'public', 'app.html'), 'utf8'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const corto = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const hhmm = (h) => {
  if (h >= 24) return '23:59';
  const m = Math.round((h % 1) * 60);
  return String(Math.floor(h)).padStart(2, '0') + ':' + String(m).padStart(2, '0');
};
const DIAS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const jsonSeguro = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16));

function datosDe(cfg, origin, local) {
  const url = origin + '/' + (local ? '?local=' + encodeURIComponent(local) : '');
  const nombre = cfg.nombre;
  const desc = corto(cfg.descripcion || ('Mirá el menú de ' + nombre + ' y hacé tu pedido online para retirar' + (cfg.zonas.length ? ' o recibirlo en tu casa' : '') + '.'), 160);
  const q = local ? '&local=' + encodeURIComponent(local) : '';
  const foto = (id, v) => origin + '/api/foto?id=' + id + '&v=' + encodeURIComponent(v) + q;
  const imagen = cfg.banner ? foto('banner', cfg.banner)
    : cfg.logo && !/^data:/.test(cfg.logo) ? foto('logo', cfg.logo)
      : origin + '/brand/minuta-mark.png';
  const h = cfg.horario || {};
  const turnos = [[h.desde, h.hasta]].concat(h.desde2 != null && h.hasta2 != null ? [[h.desde2, h.hasta2]] : []);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Restaurant', name: nombre, description: desc, url, image: imagen,
    hasMenu: url, acceptsReservations: false,
    potentialAction: { '@type': 'OrderAction', target: { '@type': 'EntryPoint', urlTemplate: url, actionPlatform: 'https://schema.org/DesktopWebPlatform' }, deliveryMethod: ['http://purl.org/goodrelations/v1#DeliveryModePickUp'].concat(cfg.zonas.length ? ['http://purl.org/goodrelations/v1#DeliveryModeOwnFleet'] : []) }
  };
  if (cfg.direccion) ld.address = { '@type': 'PostalAddress', streetAddress: cfg.direccion, addressCountry: 'AR' };
  if (cfg.whatsapp) ld.telephone = '+' + cfg.whatsapp;
  if (Array.isArray(h.dias) && h.dias.length && h.desde != null) {
    ld.openingHoursSpecification = h.dias.flatMap((d) => turnos.map(([a, b]) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: DIAS[d], opens: hhmm(a), closes: hhmm(b) })));
  }
  const titulo = nombre + ' · Pedí online';
  const tags = [
    '<title>' + esc(titulo) + '</title>',
    '<meta name="description" content="' + esc(desc) + '">',
    '<link rel="canonical" href="' + esc(url) + '">',
    '<meta name="robots" content="index,follow,max-image-preview:large">',
    '<meta name="theme-color" content="' + esc(cfg.color) + '">',
    '<meta property="og:type" content="restaurant.restaurant">',
    '<meta property="og:locale" content="es_AR">',
    '<meta property="og:site_name" content="' + esc(nombre) + '">',
    '<meta property="og:title" content="' + esc(titulo) + '">',
    '<meta property="og:description" content="' + esc(desc) + '">',
    '<meta property="og:url" content="' + esc(url) + '">',
    '<meta property="og:image" content="' + esc(imagen) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + esc(titulo) + '">',
    '<meta name="twitter:description" content="' + esc(desc) + '">',
    '<meta name="twitter:image" content="' + esc(imagen) + '">',
    '<script type="application/ld+json">' + jsonSeguro(ld) + '</script>'
  ];
  return tags.join('\n');
}

const SIN_INDEXAR = '<meta name="robots" content="noindex,nofollow">';

function armar(html, tags, boot) {
  // Con funciones, para que un "$&" escrito en el menú no se interprete como parte del reemplazo.
  const extra = tags + (boot ? '\n<script type="application/json" id="boot">' + jsonSeguro(boot) + '</script>' : '') + '\n</head>';
  return html.replace(/<title>[^<]*<\/title>/, () => '').replace('</head>', () => extra);
}

const CACHE_TIENDA = 'public, max-age=0, s-maxage=10, stale-while-revalidate=30';

// Devuelve { status, type, body, cache } para: la tienda de un local, robots.txt o sitemap.xml.
async function pagina(req) {
  const tipo = String((req.query && req.query.pagina) || 'tienda');
  const slug = slugFromReq(req);
  const { origin, local } = siteFor(req, slug);

  // Salud del sistema: sirve para un monitor externo (cada minuto) y para la página /estado.
  if (tipo === 'salud' || tipo === 'estado') {
    const t0 = Date.now();
    let ok = true;
    try { await redis.cmd('GET', 'health:ping'); } catch (e) { ok = false; }
    const ms = Date.now() - t0;
    const ahora = new Date().toISOString();
    if (tipo === 'salud') return { status: ok ? 200 : 503, type: 'application/json; charset=utf-8', body: JSON.stringify({ ok, redis: ok, ms, t: ahora }), cache: 'no-store' };
    const hora = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date());
    const body = '<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta name="robots" content="noindex,nofollow"><title>Estado del sistema · Minuta</title>' +
      '<style>body{margin:0;background:#FBF6EE;color:#231C19;font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px}' +
      '.c{max-width:460px;background:#fff;border:1px solid #E6DACA;border-radius:16px;padding:28px}.d{display:inline-block;width:14px;height:14px;border-radius:50%;margin-right:10px;background:' + (ok ? '#1F6B5C' : '#B54708') + '}' +
      'h1{margin:0 0 8px;font-size:24px}p{margin:10px 0;color:#4a3f38}small{color:#6E625A}</style></head><body><main class="c">' +
      '<h1><span class="d"></span>' + (ok ? 'El sistema funciona' : 'Tenemos un problema') + '</h1>' +
      (ok
        ? '<p>Minuta está recibiendo pedidos con normalidad. Si la tienda o el panel de tu local no abren, el problema es la conexión a internet del local: reiniciá el router o probá con los datos del celular.</p><p>Mientras tanto, tomá los pedidos por WhatsApp como siempre.</p>'
        : '<p>Estamos con una falla y ya lo estamos revisando. Los pedidos pueden no llegar al panel: tomalos por WhatsApp hasta que se normalice.</p>') +
      '<p><small>Revisado a las ' + hora + ' (hora de Argentina). Esta página se actualiza sola cada 30 segundos.</small></p></main><script src="/estado.js"></script></body></html>';
    return { status: ok ? 200 : 503, type: 'text/html; charset=utf-8', body, cache: 'no-store' };
  }

  if (tipo === 'robots') {
    const raiz = !slug;
    const lineas = ['User-agent: *'];
    if (raiz) lineas.push('Allow: /', 'Disallow: /admin', 'Disallow: /superadmin', 'Disallow: /api/');
    else lineas.push('Allow: /$', 'Disallow: /admin', 'Disallow: /api/', 'Disallow: /superadmin');
    lineas.push('', 'Sitemap: ' + origin + '/sitemap.xml');
    return { status: 200, type: 'text/plain; charset=utf-8', body: lineas.join('\n') + '\n', cache: 'public, max-age=0, s-maxage=3600' };
  }

  if (tipo === 'sitemap') {
    const urls = slug
      ? [origin + '/' + (local ? '?local=' + encodeURIComponent(local) : '')]
      : ['/inicio', '/terminos', '/privacidad'].map((p) => origin + p);
    if (slug) {
      const t = await T.getTenant(slug);
      if (!t || T.estado(t) !== 'activo') urls.length = 0;
    }
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map((u) => '  <url><loc>' + esc(u) + '</loc></url>').join('\n') + '\n</urlset>\n';
    return { status: 200, type: 'application/xml; charset=utf-8', body: xml, cache: 'public, max-age=0, s-maxage=3600' };
  }

  const html = plantilla();
  // Dirección principal (sin local): la página decide si manda a la presentación del servicio.
  if (!slug) return { status: 200, type: 'text/html; charset=utf-8', body: html, cache: 'public, max-age=0, s-maxage=60' };
  const t = await T.getTenant(slug);
  if (!t) return { status: 404, type: 'text/html; charset=utf-8', body: armar(html, SIN_INDEXAR, null), cache: 'public, max-age=0, s-maxage=30' };
  const cfg = await getConfig(slug);
  const activo = T.estado(t) === 'activo';
  const boot = { config: await stock.conQuedan(slug, cfg), abierto: activo && isOpen(cfg), storage: true, suspendido: !activo };
  return { status: 200, type: 'text/html; charset=utf-8', body: armar(html, activo ? datosDe(cfg, origin, local) : '<title>' + esc(cfg.nombre) + '</title>\n' + SIN_INDEXAR, boot), cache: CACHE_TIENDA };
}

module.exports = { pagina, datosDe, hhmm };
