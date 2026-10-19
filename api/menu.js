const { getConfig, saveConfig, sanitizeConfig, isOpen } = require('../lib/config');
const T = require('../lib/tenants');
const { send, fail, body, slugFromReq } = require('../lib/http');

// GET: menú público del local. PUT: guarda el menú (solo el dueño de ese local).
module.exports = async (req, res) => {
  try {
    // Sin subdominio ni ?local= es la página principal: el navegador va a la presentación del servicio.
    if (req.method === 'GET' && !slugFromReq(req)) return send(res, 200, { landing: true }, 'public, max-age=0, s-maxage=60');
    const tenant = await T.requireTenant(req);
    if (req.method === 'GET') {
      const cfg = await getConfig(tenant.slug);
      const activo = T.estado(tenant) === 'activo';
      const fresh = req.query && req.query.fresh;
      return send(res, 200, {
        config: cfg,
        abierto: activo && isOpen(cfg),
        storage: true,
        suspendido: !activo
      }, fresh ? 'no-store' : 'public, max-age=0, s-maxage=10, stale-while-revalidate=30');
    }
    if (req.method === 'PUT') {
      T.requireOwner(req, tenant);
      const cfg = sanitizeConfig(body(req));
      await saveConfig(tenant.slug, cfg);
      if (tenant.nombre !== cfg.nombre) {
        tenant.nombre = cfg.nombre;
        await T.saveTenant(tenant);
      }
      return send(res, 200, { ok: true, config: cfg });
    }
    send(res, 405, { error: 'method' });
  } catch (e) {
    fail(res, e);
  }
};
