const redis = require('../lib/redis');
const { createLead } = require('../lib/site');
const { send, fail, body, ip, tope, Reject } = require('../lib/http');

// Solicitud pública de un local que quiere el servicio. No crea nada activo:
// queda en tu panel para que la revises y la apruebes.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  try {
    if (!redis.enabled()) {
      const e = new Error('storage_not_configured');
      e.code = 'storage_not_configured';
      throw e;
    }
    tope(req, 10000);
    const b = body(req);
    if (b.web) return send(res, 200, { ok: true }); // campo trampa para robots
    if (!(await redis.limit('rl:lead:' + ip(req), 4, 3600))) throw new Reject('Ya mandaste varias solicitudes. Probá más tarde o escribinos por WhatsApp.', 429, 'demasiados');
    await createLead(b);
    send(res, 200, { ok: true });
  } catch (e) {
    fail(res, e);
  }
};
