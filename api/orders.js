const T = require('../lib/tenants');
const { ESTADOS, FINAL, getOrder, saveOrder, ordersPanel, marcarActivo, setEstado, clean } = require('../lib/orders');
const redis = require('../lib/redis');
const { estadisticas } = require('../lib/stats');
const { send, fail, body, Reject } = require('../lib/http');

// Panel del local. GET: últimos pedidos. PATCH: cambia el estado de un pedido.
module.exports = async (req, res) => {
  try {
    const tenant = await T.requireTenant(req);
    T.requireOwner(req, tenant);
    if (req.method === 'GET') {
      const q = req.query || {};
      // Estadísticas: ?stats=7 (última semana) o ?stats=30 (último mes), comparadas con el período anterior.
      if (q.stats !== undefined) return send(res, 200, await estadisticas(tenant.slug, Number(q.stats)));
      const todo = q.todo === '1' || q.todo === 1;
      const [rev, cfgRev] = (await redis.cmd('MGET', redis.tk(tenant.slug, 'orders:rev'), redis.tk(tenant.slug, 'cfgrev'))).map((x) => Number(x) || 0);
      const base = { rev, cfgRev, estado: T.estado(tenant), venceEl: tenant.venceEl };
      // Consulta liviana sin cambios desde la última vez: no se lee ningún pedido.
      if (!todo && q.rev !== undefined && Number(q.rev) === rev) return send(res, 200, Object.assign({ orders: [], sinCambios: true }, base));
      return send(res, 200, Object.assign({ orders: await ordersPanel(tenant.slug, todo) }, base));
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
      // Si volvió a estar en curso (por ejemplo, un rechazo deshecho), vuelve a la lista de activos.
      if (!FINAL.includes(o.estado)) await marcarActivo(tenant.slug, o.id);
      return send(res, 200, { ok: true, order: o });
    }
    send(res, 405, { error: 'method' });
  } catch (e) {
    fail(res, e);
  }
};
