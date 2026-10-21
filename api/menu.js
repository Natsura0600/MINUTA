const { getConfig, saveConfig, sanitizeConfig, isOpen, imgKey, imagenesDe, logoLegado } = require('../lib/config');
const img = require('../lib/imagenes');
const T = require('../lib/tenants');
const stock = require('../lib/stock');
const seo = require('../lib/seo');
const { send, fail, body, slugFromReq } = require('../lib/http');

// GET: menú público del local. PUT: guarda el menú (solo el dueño de ese local).
module.exports = async (req, res) => {
  try {
    // La tienda (con sus metadatos para buscadores y WhatsApp), robots.txt y sitemap.xml salen de acá:
    // Vercel Hobby permite 12 funciones y ya estamos cerca, así que no se crea una nueva.
    if (req.method === 'GET' && req.query && req.query.pagina) {
      try {
        const p = await seo.pagina(req);
        res.statusCode = p.status;
        res.setHeader('Content-Type', p.type);
        res.setHeader('Cache-Control', p.cache);
        return res.end(p.body);
      } catch (e) {
        console.error(e);
        res.statusCode = 302; // si algo falla, la tienda estática igual abre y carga su menú sola
        res.setHeader('Location', '/app.html' + (req.query.local ? '?local=' + encodeURIComponent(req.query.local) : ''));
        return res.end();
      }
    }
    // Sin subdominio ni ?local= es la página principal: el navegador va a la presentación del servicio.
    if (req.method === 'GET' && !slugFromReq(req)) return send(res, 200, { landing: true }, 'public, max-age=0, s-maxage=60');
    const tenant = await T.requireTenant(req);
    if (req.method === 'GET') {
      const cfg = await getConfig(tenant.slug);
      const activo = T.estado(tenant) === 'activo';
      const fresh = req.query && req.query.fresh;
      return send(res, 200, {
        config: await stock.conQuedan(tenant.slug, cfg),
        abierto: activo && isOpen(cfg),
        storage: true,
        suspendido: !activo
      }, fresh ? 'no-store' : 'public, max-age=0, s-maxage=10, stale-while-revalidate=30');
    }
    if (req.method === 'PUT') {
      T.requireOwner(req, tenant);
      const b = body(req);
      const cfg = sanitizeConfig(b);
      const actual = await getConfig(tenant.slug);
      // Control de versión: si otro dispositivo guardó después de que este cargó, no se pisa.
      if (b.rev !== undefined && Number(b.rev) !== actual.rev) {
        return send(res, 409, { error: 'conflicto', mensaje: 'Otro dispositivo guardó cambios mientras editabas.', config: actual });
      }
      await logoLegado(tenant.slug, cfg);
      cfg.rev = actual.rev + 1;
      const antes = imagenesDe(actual);
      await saveConfig(tenant.slug, cfg);
      await stock.aplicarCambios(tenant.slug, actual, cfg, b);
      // Borra las fotos de productos eliminados o reemplazados.
      const ahora = imagenesDe(cfg);
      const sobran = [...antes.keys()].filter((id) => !ahora.has(id));
      if (sobran.length) await img.borrar(sobran.map((id) => imgKey(tenant.slug, id))).catch(() => {});
      if (tenant.nombre !== cfg.nombre) {
        tenant.nombre = cfg.nombre;
        await T.saveTenant(tenant);
      }
      return send(res, 200, { ok: true, config: await stock.conQuedan(tenant.slug, cfg) });
    }
    send(res, 405, { error: 'method' });
  } catch (e) {
    fail(res, e);
  }
};
