const T = require('../lib/tenants');
const { getOrder, syncPayment } = require('../lib/orders');
const { send, fail, Reject } = require('../lib/http');

// Estado de un pedido para la pantalla a la que vuelve el cliente después de pagar.
// Devuelve solo lo necesario, sin datos personales.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method' });
  try {
    const tenant = await T.requireTenant(req);
    const q = req.query || {};
    let o = await getOrder(tenant.slug, q.id);
    if (!o) throw new Reject('No encontramos ese pedido.', 404, 'pedido_no_encontrado');
    if (o.estado === 'pendiente_pago' && o.pago.metodo === 'mp' && q.payment_id && tenant.mp) {
      try {
        const u = await syncPayment(tenant.slug, T.mpToken(tenant), String(q.payment_id));
        if (u && u.id === o.id) o = u;
      } catch (e) {
        console.error('order sync', e);
      }
    }
    send(res, 200, { id: o.id, numero: o.numero, estado: o.estado, pago: { metodo: o.pago.metodo, estado: o.pago.estado }, total: o.total });
  } catch (e) {
    fail(res, e);
  }
};
