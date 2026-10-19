const T = require('../lib/tenants');
const { ESTADOS, getOrder, saveOrder, listOrders } = require('../lib/orders');
const { send, fail, body, Reject } = require('../lib/http');

// Panel del local. GET: últimos pedidos. PATCH: cambia el estado de un pedido.
module.exports = async (req, res) => {
  try {
    const tenant = await T.requireTenant(req);
    T.requireOwner(req, tenant);
    if (req.method === 'GET') {
      return send(res, 200, { orders: await listOrders(tenant.slug, 60), mp: Boolean(tenant.mp), estado: T.estado(tenant), venceEl: tenant.venceEl });
    }
    if (req.method === 'PATCH') {
      const b = body(req);
      if (!ESTADOS.includes(b.estado) || b.estado === 'pendiente_pago') throw new Reject('Estado inválido.', 400);
      const o = await getOrder(tenant.slug, b.id);
      if (!o) throw new Reject('No encontramos ese pedido.', 404, 'pedido_no_encontrado');
      o.estado = b.estado;
      await saveOrder(tenant.slug, o);
      return send(res, 200, { ok: true, order: o });
    }
    send(res, 405, { error: 'method' });
  } catch (e) {
    fail(res, e);
  }
};
