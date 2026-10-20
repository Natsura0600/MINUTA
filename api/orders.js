const T = require('../lib/tenants');
const { ESTADOS, getOrder, saveOrder, listOrders, setEstado, clean } = require('../lib/orders');
const { send, fail, body, Reject } = require('../lib/http');

// Panel del local. GET: últimos pedidos. PATCH: cambia el estado de un pedido.
module.exports = async (req, res) => {
  try {
    const tenant = await T.requireTenant(req);
    T.requireOwner(req, tenant);
    if (req.method === 'GET') {
      return send(res, 200, { orders: await listOrders(tenant.slug, Math.min(200, Math.max(1, Number((req.query || {}).n) || 60))), estado: T.estado(tenant), venceEl: tenant.venceEl });
    }
    if (req.method === 'PATCH') {
      const b = body(req);
      const o = await getOrder(tenant.slug, b.id);
      if (!o) throw new Reject('No encontramos ese pedido.', 404, 'pedido_no_encontrado');
      if (typeof b.pagado === 'boolean') o.pago.pagado = b.pagado;
      // Nota interna del local (el cliente no la ve).
      if (typeof b.notaLocal === 'string') o.notaLocal = clean(b.notaLocal, 200);
      if (b.estado !== undefined) {
        if (!ESTADOS.includes(b.estado)) throw new Reject('Estado inválido.', 400);
        if (b.estado === 'en_camino' && o.entrega.modo !== 'delivery') throw new Reject('Solo los pedidos con delivery pueden ir en camino.', 400);
        setEstado(o, b.estado);
        // Motivo del rechazo: el cliente lo ve en el seguimiento.
        if (b.estado === 'cancelado') o.motivo = clean(b.motivo, 120);
        else delete o.motivo;
      }
      await saveOrder(tenant.slug, o);
      return send(res, 200, { ok: true, order: o });
    }
    send(res, 405, { error: 'method' });
  } catch (e) {
    fail(res, e);
  }
};
