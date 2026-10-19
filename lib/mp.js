// Mercado Pago, solo con fetch. Cada llamada usa el token del local, que se guarda cifrado.
const BASE = 'https://api.mercadopago.com';

async function call(token, path, opts) {
  const r = await fetch(BASE + path, Object.assign({}, opts, {
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
  }));
  const body = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, body };
}

async function createPreference(token, pref) {
  const r = await call(token, '/checkout/preferences', { method: 'POST', body: JSON.stringify(pref) });
  if (!r.ok || !r.body || !r.body.init_point) {
    console.error('Mercado Pago no creó la preferencia', r.status, JSON.stringify(r.body));
    throw new Error('mp_preference_failed');
  }
  return r.body;
}

// Devuelve null si el pago no existe (por ejemplo, las notificaciones de prueba del panel de MP).
async function getPayment(token, id) {
  if (!/^\d{3,20}$/.test(String(id))) return null;
  const r = await call(token, '/v1/payments/' + id);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('mp_payment_lookup_failed:' + r.status);
  return r.body;
}

// Comprueba que el token sea de una cuenta real. Solo se rechaza si Mercado Pago dice que no es válido.
async function checkToken(token) {
  const r = await call(token, '/users/me');
  return r.status !== 401;
}

module.exports = { createPreference, getPayment, checkToken };
