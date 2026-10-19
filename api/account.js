const cr = require('../lib/crypto');
const T = require('../lib/tenants');
const { send, fail, body, Reject } = require('../lib/http');

// Cuenta del local: datos del plan y cambio de contraseña.
module.exports = async (req, res) => {
  try {
    const tenant = await T.requireTenant(req);
    T.requireOwner(req, tenant);

    if (req.method === 'GET') {
      return send(res, 200, {
        email: tenant.email, nombre: tenant.nombre,
        estado: T.estado(tenant), venceEl: tenant.venceEl
      });
    }

    if (req.method === 'POST') {
      const b = body(req);

      if (b.accion === 'clave') {
        const nueva = String(b.nueva || '');
        if (nueva.length < 8 || nueva.length > 72) throw new Reject('La contraseña nueva tiene que tener entre 8 y 72 caracteres.', 400);
        if (!(await cr.checkPassword(String(b.actual || ''), tenant.pass))) {
          await new Promise((r) => setTimeout(r, 600));
          throw new Reject('La contraseña actual no es correcta.', 400);
        }
        await T.setPassword(tenant, nueva);
        await T.saveTenant(tenant);
        return send(res, 200, { ok: true, token: T.newSession(tenant) });
      }

      throw new Reject('Acción desconocida.', 400);
    }
    send(res, 405, { error: 'method' });
  } catch (e) {
    fail(res, e);
  }
};
