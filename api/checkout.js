const crypto = require('crypto');
const redis = require('../lib/redis');
const mp = require('../lib/mp');
const T = require('../lib/tenants');
const { getConfig, isOpen } = require('../lib/config');
const { buildOrder, preferenceFor, saveOrder, addToList, nextNumber } = require('../lib/orders');
const { send, fail, body, ip, siteFor, Reject } = require('../lib/http');

// Recibe el pedido de un local, lo valida con los precios de ese local, lo guarda y,
// si se paga con Mercado Pago, devuelve el link de pago (cobra en la cuenta del local).
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

    const order = buildOrder(cfg, body(req), { mpOk: Boolean(tenant.mp) && cfg.aceptaMP });
    order.id = crypto.randomBytes(8).toString('hex');
    order.numero = await nextNumber(slug);

    let initPoint = null;
    if (order.pago.metodo === 'mp') {
      const pref = await mp.createPreference(T.mpToken(tenant), preferenceFor(order, cfg, siteFor(req, slug)));
      order.pago.preferenceId = pref.id;
      initPoint = pref.init_point;
    }

    await saveOrder(slug, order);
    await addToList(slug, order.id);
    send(res, 200, { ok: true, id: order.id, numero: order.numero, init_point: initPoint });
  } catch (e) {
    if (e && e.message === 'mp_preference_failed') {
      return send(res, 502, { error: 'mp', mensaje: 'No pudimos abrir Mercado Pago. Probá de nuevo o elegí otra forma de pago.' });
    }
    fail(res, e);
  }
};
