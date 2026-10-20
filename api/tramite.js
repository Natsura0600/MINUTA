const redis = require('../lib/redis');
const { createTramite } = require('../lib/site');
const { send, fail, body, ip, Reject } = require('../lib/http');

// Botón de arrepentimiento y botón de baja: público, sin registro previo.
// Devuelve el código del trámite en el momento.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  try {
    if (!redis.enabled()) {
      const e = new Error('storage_not_configured');
      e.code = 'storage_not_configured';
      throw e;
    }
    const b = body(req);
    if (b.web) return send(res, 200, { ok: true, codigo: 'MN-000000' }); // trampa para robots
    if (!(await redis.limit('rl:tram:' + ip(req), 6, 3600))) throw new Reject('Ya registraste varios trámites. Escribinos por WhatsApp.', 429, 'demasiados');
    const t = await createTramite(b);
    send(res, 200, { ok: true, codigo: t.codigo, tipo: t.tipo, creado: t.creado });
  } catch (e) {
    fail(res, e);
  }
};
