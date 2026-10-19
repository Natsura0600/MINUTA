const cr = require('../lib/crypto');
const mp = require('../lib/mp');
const T = require('../lib/tenants');
const { send, fail, body, Reject } = require('../lib/http');

const MP_TOKEN = /^(APP_USR|TEST)-[A-Za-z0-9_-]{20,}$/;

// Cuenta del local: datos, cambio de contraseña y conexión con Mercado Pago.
module.exports = async (req, res) => {
  try {
    const tenant = await T.requireTenant(req);
    T.requireOwner(req, tenant);

    if (req.method === 'GET') {
      return send(res, 200, {
        email: tenant.email, nombre: tenant.nombre,
        estado: T.estado(tenant), venceEl: tenant.venceEl,
        mp: { conectado: Boolean(tenant.mp), last4: tenant.mp ? tenant.mp.last4 : null }
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

      if (b.accion === 'mp') {
        const token = String(b.token || '').trim();
        if (!MP_TOKEN.test(token)) throw new Reject('Ese Access Token no tiene el formato de Mercado Pago. Empieza con APP_USR- o TEST-.', 400);
        if (!(await mp.checkToken(token))) throw new Reject('Mercado Pago no reconoce ese Access Token. Revisá que lo copiaste completo.', 400);
        tenant.mp = { enc: cr.encrypt(token), last4: token.slice(-4), desde: new Date().toISOString() };
        await T.saveTenant(tenant);
        return send(res, 200, { ok: true, mp: { conectado: true, last4: tenant.mp.last4 } });
      }

      if (b.accion === 'mp_quitar') {
        tenant.mp = null;
        await T.saveTenant(tenant);
        return send(res, 200, { ok: true, mp: { conectado: false, last4: null } });
      }
      throw new Reject('Acción desconocida.', 400);
    }
    send(res, 405, { error: 'method' });
  } catch (e) {
    fail(res, e);
  }
};
