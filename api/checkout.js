const crypto = require('crypto');
const redis = require('../lib/redis');
const T = require('../lib/tenants');
const { getConfig, isOpen } = require('../lib/config');
const { buildOrder, saveOrder, addToList, nextNumber } = require('../lib/orders');
const { send, fail, body, ip, Reject } = require('../lib/http');

// Recibe el pedido de un local, lo valida con los precios de ese local y lo guarda.
// Le aparece al instante en su panel; el aviso al cliente lo manda el local por WhatsApp.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  try {
    const tenant = await T.requireTenant(req);
    const slug = tenant.slug;
    if (!(await redis.limit('rl:co:' + slug + ':' + ip(req), 8, 60))) throw new Reject('Demasiados intentos. Esperá un minuto.', 429, 'demasiados');
    if (T.estado(tenant) !== 'activo') throw new Reject('Este local no está tomando pedidos por ahora.', 403, 'suspendido');

    const cfg = await getConfig(slug);
    if (!isOpen(cfg)) {
      throw new Reject(cfg.pausado ? 'El local no está tomando pedidos en este momento.' : 'El local está cerrado ahora. Volvé a intentar cuando abra.', 409, 'cerrado');
    }

    const order = buildOrder(cfg, body(req));
    order.id = crypto.randomBytes(8).toString('hex');
    order.numero = await nextNumber(slug);
    await saveOrder(slug, order);
    await addToList(slug, order.id);
    send(res, 200, { ok: true, id: order.id, numero: order.numero });
  } catch (e) {
    fail(res, e);
  }
};
