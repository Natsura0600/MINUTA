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
    const datos = body(req);
    // Clave de este intento de pedido (la genera el navegador). Si el cliente reintenta con la misma clave
    // (doble toque, se cortó la conexión), devolvemos el pedido ya creado en lugar de crear otro.
    const clave = /^[A-Za-z0-9_-]{16,64}$/.test(String(datos.clave || '')) ? String(datos.clave) : '';
    const ikey = clave ? redis.tk(slug, 'idem:' + clave) : '';
    if (ikey) {
      const previo = await redis.cmd('GET', ikey);
      if (previo && previo !== 'pend') {
        const [id, numero] = previo.split(':');
        return send(res, 200, { ok: true, id, numero: Number(numero), repetido: true });
      }
    }
    if (!(await redis.limit('rl:co:' + slug + ':' + ip(req), 8, 60))) throw new Reject('Demasiados intentos. Esperá un minuto.', 429, 'demasiados');
    if (T.estado(tenant) !== 'activo') throw new Reject('Este local no está tomando pedidos por ahora.', 403, 'suspendido');

    const cfg = await getConfig(slug);
    if (!isOpen(cfg)) {
      throw new Reject(cfg.pausado ? 'El local no está tomando pedidos en este momento.' : 'El local está cerrado ahora. Volvé a intentar cuando abra.', 409, 'cerrado');
    }

    // Campo trampa que un cliente real no ve: si viene completo, es un robot. Le decimos que salió bien y no se guarda nada.
    if (datos.web) return send(res, 200, { ok: true, id: crypto.randomBytes(8).toString('hex'), numero: 0 });
    // Un mismo teléfono no manda más de 4 pedidos cada 10 minutos (evita inundar el panel con pedidos falsos).
    const tel = String((datos.cliente && datos.cliente.tel) || '').replace(/\D/g, '');
    if (tel && !(await redis.limit('rl:cot:' + slug + ':' + tel, 4, 600))) throw new Reject('Ya mandaste varios pedidos. Esperá unos minutos o llamá al local.', 429, 'demasiados');
    // Se reserva la clave antes de crear nada: dos envíos simultáneos con la misma clave no crean dos pedidos.
    if (ikey && (await redis.cmd('SET', ikey, 'pend', 'NX', 'EX', 60)) === null) {
      const v = await redis.cmd('GET', ikey);
      if (v && v !== 'pend') { const [id, numero] = v.split(':'); return send(res, 200, { ok: true, id, numero: Number(numero), repetido: true }); }
      throw new Reject('Tu pedido se está procesando. Esperá unos segundos.', 409, 'en_proceso');
    }
    try {
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
      if (ikey) await redis.cmd('SET', ikey, order.id + ':' + order.numero, 'EX', 900);
      send(res, 200, { ok: true, id: order.id, numero: order.numero });
    } catch (e) {
      if (ikey) await redis.cmd('DEL', ikey).catch(() => {}); // si falló, el cliente puede reintentar con la misma clave
      throw e;
    }
  } catch (e) {
    await fail(res, e);
  }
};
