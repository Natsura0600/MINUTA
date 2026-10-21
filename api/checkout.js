const crypto = require('crypto');
const redis = require('../lib/redis');
const T = require('../lib/tenants');
const { getConfig, isOpen } = require('../lib/config');
const { buildOrder, saveOrder, addToList, nextNumber } = require('../lib/orders');
const stock = require('../lib/stock');
const { send, fail, body, ip, tope, Reject } = require('../lib/http');

// Recibe el pedido de un local, lo valida con los precios de ese local y lo guarda.
// Le aparece al instante en su panel; el aviso al cliente lo manda el local por WhatsApp.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  try {
    tope(req, 20000);
    const tenant = await T.requireTenant(req);
    const slug = tenant.slug;
    if (!(await redis.limit('rl:co:' + slug + ':' + ip(req), 8, 60))) throw new Reject('Demasiados intentos. Esperá un minuto.', 429, 'demasiados');
    if (T.estado(tenant) !== 'activo') throw new Reject('Este local no está tomando pedidos por ahora.', 403, 'suspendido');

    const cfg = await getConfig(slug);
    if (!isOpen(cfg)) {
      throw new Reject(cfg.pausado ? 'El local no está tomando pedidos en este momento.' : 'El local está cerrado ahora. Volvé a intentar cuando abra.', 409, 'cerrado');
    }

    const datos = body(req);
    // Campo trampa que un cliente real no ve: si viene completo, es un robot. Le decimos que salió bien y no se guarda nada.
    if (datos.web) return send(res, 200, { ok: true, id: crypto.randomBytes(8).toString('hex'), numero: 0 });
    // Un mismo teléfono no manda más de 4 pedidos cada 10 minutos (evita inundar el panel con pedidos falsos).
    const tel = String((datos.cliente && datos.cliente.tel) || '').replace(/\D/g, '');
    if (tel && !(await redis.limit('rl:cot:' + slug + ':' + tel, 4, 600))) throw new Reject('Ya mandaste varios pedidos. Esperá unos minutos o llamá al local.', 429, 'demasiados');
    const order = buildOrder(cfg, datos);
    order.id = crypto.randomBytes(8).toString('hex');
    // Descuenta el stock de los productos con cantidad limitada (atómico: nadie se lleva lo que ya se vendió).
    const reserva = await stock.reservar(slug, cfg, order.items);
    if (Object.keys(reserva).length) order.reserva = reserva;
    try {
      order.numero = await nextNumber(slug);
      await saveOrder(slug, order);
    } catch (e) {
      await stock.devolver(slug, order).catch(() => {});
      throw e;
    }
    await addToList(slug, order.id);
    send(res, 200, { ok: true, id: order.id, numero: order.numero });
  } catch (e) {
    fail(res, e);
  }
};
