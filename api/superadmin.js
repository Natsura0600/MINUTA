const redis = require('../lib/redis');
const cr = require('../lib/crypto');
const T = require('../lib/tenants');
const site = require('../lib/site');
const { rootDomain, send, fail, body, requireSuper, Reject } = require('../lib/http');

function vista(m) {
  const root = rootDomain();
  return {
    slug: m.slug, nombre: m.nombre, email: m.email,
    activo: m.activo, venceEl: m.venceEl, estado: T.estado(m),
    notas: m.notas || '', creado: m.creado,
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
      const locales = (await T.listTenants()).map(vista);
      const [plan, solicitudes] = await Promise.all([site.getPlan(), site.listLeads()]);
      return send(res, 200, { locales, rootDomain: rootDomain() || null, plan, solicitudes });
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
      const { meta, password } = await T.createTenant({ nombre: lead.nombre, slug: b.slug, email: lead.email, venceEl: b.venceEl });
      lead.estado = 'aprobada';
      lead.slug = meta.slug;
      await site.saveLead(lead);
      return send(res, 200, { ok: true, local: vista(meta), password, whatsapp: lead.whatsapp });
    }

    const m = await T.getTenant(String(b.slug || ''));
    if (!m) throw new Reject('No encontramos ese local.', 404, 'local_no_encontrado');

    if (b.accion === 'editar') {
      if (typeof b.activo === 'boolean') m.activo = b.activo;
      if ('venceEl' in b) m.venceEl = T.validarFecha(b.venceEl);
      if (typeof b.notas === 'string') m.notas = b.notas.trim().slice(0, 200);
      if (typeof b.email === 'string' && b.email.trim()) m.email = b.email.trim().toLowerCase();
      await T.saveTenant(m);
      return send(res, 200, { ok: true, local: vista(m) });
    }
    if (b.accion === 'pago') {
      const meses = Number.isInteger(b.meses) && b.meses >= 1 && b.meses <= 12 ? b.meses : 1;
      T.registrarPago(m, meses);
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
