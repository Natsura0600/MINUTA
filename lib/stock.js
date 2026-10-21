const redis = require('./redis');
const { Reject } = require('./http');

// Stock por cantidad (opcional). El producto guarda en la configuración `stock` (null = sin límite).
// La cantidad que queda vive aparte, en un contador de Redis: DECRBY es atómico, así que dos clientes
// que piden el último plato al mismo tiempo no pasan los dos.
const skey = (slug, pid) => redis.tk(slug, 'stk:' + pid);
const controlados = (cfg) => (cfg.menu || []).filter((p) => Number.isInteger(p.stock));

// Agrega `quedan` a cada producto con stock, para mostrarlo en la tienda y en el panel.
async function conQuedan(slug, cfg) {
  const ps = controlados(cfg);
  if (!ps.length) return cfg;
  const vals = await redis.cmd('MGET', ...ps.map((p) => skey(slug, p.id)));
  const out = Object.assign({}, cfg, { menu: cfg.menu.map((p) => Object.assign({}, p)) });
  const byId = new Map(out.menu.map((p) => [p.id, p]));
  ps.forEach((p, i) => {
    const v = vals[i];
    byId.get(p.id).quedan = v === null || v === undefined ? p.stock : Math.max(0, Number(v));
  });
  return out;
}

// Reserva las unidades del pedido. Si algo no alcanza, devuelve lo ya descontado y rechaza.
async function reservar(slug, cfg, items) {
  const pedido = new Map();
  items.forEach((i) => pedido.set(i.id, (pedido.get(i.id) || 0) + i.qty));
  const reserva = {};
  const deshacer = async () => {
    for (const [id, n] of Object.entries(reserva)) await redis.cmd('INCRBY', skey(slug, id), n).catch(() => {});
  };
  for (const [id, qty] of pedido) {
    const p = cfg.menu.find((x) => x.id === id);
    if (!p || !Number.isInteger(p.stock)) continue;
    try {
      await redis.cmd('SET', skey(slug, id), String(p.stock), 'NX');
      const resto = await redis.cmd('DECRBY', skey(slug, id), qty);
      reserva[id] = qty;
      if (resto < 0) {
        await deshacer();
        const quedan = Math.max(0, resto + qty);
        throw new Reject(quedan ? 'Solo quedan ' + quedan + ' de "' + p.nom + '". Bajá la cantidad.' : '"' + p.nom + '" se agotó recién.', 409, 'sin_stock');
      }
    } catch (e) {
      if (!(e instanceof Reject)) await deshacer();
      throw e;
    }
  }
  return reserva;
}

// Cancelar o rechazar un pedido devuelve las unidades (una sola vez). Deshacer el rechazo las vuelve a descontar.
async function devolver(slug, o) {
  if (!o.reserva || o.repuesto) return;
  for (const [id, n] of Object.entries(o.reserva)) await redis.cmd('INCRBY', skey(slug, id), n);
  o.repuesto = true;
}
async function retomar(slug, o) {
  if (!o.reserva || !o.repuesto) return;
  for (const [id, n] of Object.entries(o.reserva)) await redis.cmd('DECRBY', skey(slug, id), n);
  o.repuesto = false;
}

// Al guardar el menú: si el dueño cambió la cantidad (o tocó "reponer"), el contador arranca de nuevo.
async function aplicarCambios(slug, anterior, nuevo, crudo) {
  const antes = new Map((anterior.menu || []).map((p) => [p.id, p]));
  const reponer = new Set((crudo.menu || []).filter((p) => p && p.reponer).map((p) => String(p.id)));
  for (const p of nuevo.menu) {
    const a = antes.get(p.id);
    if (!Number.isInteger(p.stock)) {
      if (a && Number.isInteger(a.stock)) await redis.cmd('DEL', skey(slug, p.id));
    } else if (!a || a.stock !== p.stock || reponer.has(p.id)) {
      await redis.cmd('SET', skey(slug, p.id), String(p.stock));
    }
  }
}

module.exports = { skey, conQuedan, reservar, devolver, retomar, aplicarCambios };
