const T = require('../lib/tenants');
const { getOrder } = require('../lib/orders');
const { send, fail, Reject } = require('../lib/http');

// Seguimiento del pedido para el cliente. Devuelve solo lo necesario, sin datos personales.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method' });
  try {
    const tenant = await T.requireTenant(req);
    const o = await getOrder(tenant.slug, (req.query || {}).id);
    if (!o) throw new Reject('No encontramos ese pedido.', 404, 'pedido_no_encontrado');
    send(res, 200, {
      id: o.id, numero: o.numero, estado: o.estado, modo: o.entrega.modo,
      pago: { metodo: o.pago.metodo, pagado: Boolean(o.pago.pagado) }, total: o.total
    }, 'no-store');
  } catch (e) {
    fail(res, e);
  }
};
