const T = require('../lib/tenants');
const { syncPayment } = require('../lib/orders');
const { send, body, slugFromReq } = require('../lib/http');

// Aviso automático de Mercado Pago para un local. No se confía en lo que llega:
// solo se toma el número de pago y se consulta a Mercado Pago con el token de ese local.
// Sigue funcionando aunque el local esté suspendido, para no perder pagos ya hechos.
module.exports = async (req, res) => {
  try {
    const b = body(req);
    const q = req.query || {};
    const type = q.type || q.topic || b.type || b.topic;
    const id = q['data.id'] || (b.data && b.data.id) || (q.topic === 'payment' ? q.id : null);
    if (type === 'payment' && id) {
      const tenant = await T.getTenant(slugFromReq(req));
      if (tenant && tenant.mp) await syncPayment(tenant.slug, T.mpToken(tenant), String(id));
    }
    send(res, 200, { ok: true });
  } catch (e) {
    console.error('webhook', e);
    send(res, 500, { ok: false });
  }
};
