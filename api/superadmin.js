const redis = require('../lib/redis');
const cr = require('../lib/crypto');
const T = require('../lib/tenants');
const site = require('../lib/site');
const { rootDomain, send, fail, body, requireSuper, Reject } = require('../lib/http');

function vista(m, pedidos) {
  const root = rootDomain();
  return {
    slug: m.slug, nombre: m.nombre, email: m.email,
    activo: m.activo, venceEl: m.venceEl, estado: T.estado(m),
    notas: m.notas || '', creado: m.creado,
    whatsapp: m.whatsapp || '', contacto: m.contacto || '', cuota: m.cuota || 0,
    pagos: (m.pagos || []).slice(0, 12), pedidos: Number(pedidos) || 0,
    url: !root ? null : /\.vercel\.app$/.test(root) ? 'https://' + root + '/?local=' + m.slug : 'https://' + m.slug + '.' + root
  };
}

// Tu panel: alta de locales, mensualidad, suspensión y contraseñas.
module.exports = async (req, res) => {
  try {
    if (!redis.enabled()) {
      const e = new Error('storage_not_configured');
      e.code = 'storage_not_configured';
      throw e;
    }
    await requireSuper(req);

    if (req.method === 'GET') {
      const metas = await T.listTenants();
      const seqs = metas.length ? await redis.cmd('MGET', ...metas.map((m) => redis.tk(m.slug, 'orders:seq'))) : [];
      const locales = metas.map((m, i) => vista(m, seqs[i]));
      const [plan, solicitudes, tramites] = await Promise.all([site.getPlan(), site.listLeads(), site.listTramites()]);
      return send(res, 200, { locales, rootDomain: rootDomain() || null, plan, solicitudes, tramites, hoy: T.hoyAR() });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });

    const b = body(req);
    if (b.accion === 'crear') {
      const { meta, password } = await T.createTenant(b);
      return send(res, 200, { ok: true, local: vista(meta), password });
    }

    if (b.accion === 'plan') {
      const plan = site.sanitizePlan(b.plan);
      await site.savePlan(plan);
      return send(res, 200, { ok: true, plan });
    }
    if (b.accion === 'solicitud_borrar') {
      await site.deleteLead(String(b.id || ''));
      return send(res, 200, { ok: true });
    }
    if (b.accion === 'solicitud_aprobar') {
      const lead = await site.getLead(b.id);
      if (!lead) throw new Reject('No encontramos esa solicitud.', 404);
      const { meta, password } = await T.createTenant({ nombre: lead.nombre, slug: b.slug, email: lead.email, venceEl: b.venceEl, whatsapp: lead.whatsapp });
      lead.estado = 'aprobada';
      lead.slug = meta.slug;
      await site.saveLead(lead);
      return send(res, 200, { ok: true, local: vista(meta), password, whatsapp: lead.whatsapp });
    }

    if (b.accion === 'tramite') {
      const t = await site.setTramite(b.id, b.estado);
      return send(res, 200, { ok: true, tramite: t });
    }

    const m = await T.getTenant(String(b.slug || ''));
    if (!m) throw new Reject('No encontramos ese local.', 404, 'local_no_encontrado');

    if (b.accion === 'editar') {
      if (typeof b.activo === 'boolean') m.activo = b.activo;
      if ('venceEl' in b) m.venceEl = T.validarFecha(b.venceEl);
      if (typeof b.notas === 'string') m.notas = b.notas.trim().slice(0, 200);
      if (typeof b.email === 'string' && b.email.trim()) {
        const em = b.email.trim().toLowerCase();
        if (!/^[^\s@]{1,64}@[^\s@]{1,200}\.[^\s@]{2,}$/.test(em)) throw new Reject('El email no es válido.', 400);
        m.email = em;
      }
      if (typeof b.nombre === 'string' && b.nombre.trim().length >= 2) m.nombre = b.nombre.trim().replace(/\s+/g, ' ').slice(0, 40);
      if (typeof b.whatsapp === 'string') m.whatsapp = T.soloDigitos(b.whatsapp);
      if (typeof b.contacto === 'string') m.contacto = b.contacto.trim().slice(0, 60);
      if (b.cuota !== undefined) {
        const c = Number(b.cuota);
        if (!Number.isInteger(c) || c < 0 || c > 10000000) throw new Reject('La cuota tiene que ser un número entero.', 400);
        m.cuota = c;
      }
      await T.saveTenant(m);
      return send(res, 200, { ok: true, local: vista(m) });
    }
    if (b.accion === 'pago') {
      const meses = Number.isInteger(b.meses) && b.meses >= 1 && b.meses <= 12 ? b.meses : 1;
      T.registrarPago(m, meses, Number.isInteger(b.monto) ? b.monto : (m.cuota || 0) * meses);
      await T.saveTenant(m);
      return send(res, 200, { ok: true, local: vista(m) });
    }
    if (b.accion === 'clave') {
      const password = cr.randomPassword();
      await T.setPassword(m, password);
      await T.saveTenant(m);
      return send(res, 200, { ok: true, local: vista(m), password });
    }
    if (b.accion === 'borrar') {
      if (b.confirmar !== m.slug) throw new Reject('Para borrar el local, escribí su dirección para confirmar.', 400);
      await T.deleteTenant(m.slug);
      return send(res, 200, { ok: true });
    }
    throw new Reject('Acción desconocida.', 400);
  } catch (e) {
    fail(res, e);
  }
};
