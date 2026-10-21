const redis = require('./redis');

// Dos registros globales, consultables desde el Superadmin:
//  - errores: fallos del servidor (500) con ruta, mensaje y las primeras líneas del error;
//  - auditoría: operaciones sensibles (contraseñas, suspensiones, pagos, borrados, menú publicado).
// Escribir el registro nunca puede romper el pedido: si Redis falla, se ignora.
const K_ERR = 'log:errores', K_AUD = 'log:auditoria';
const MAX_ERR = 300, MAX_AUD = 1000;

async function push(key, entry, max) {
  try {
    await redis.cmd('LPUSH', key, JSON.stringify(entry));
    await redis.cmd('LTRIM', key, 0, max - 1);
  } catch (e) { /* el registro es secundario */ }
}

async function error(e, res) {
  const req = (res && res.req) || {};
  const h = req.headers || {};
  await push(K_ERR, {
    t: new Date().toISOString(),
    ruta: String(req.url || '').split('?')[0].slice(0, 80),
    metodo: req.method || '',
    host: String(h.host || '').slice(0, 80),
    msg: String((e && e.message) || e).slice(0, 300),
    pila: String((e && e.stack) || '').split('\n').slice(1, 5).map((l) => l.trim()).join(' | ').slice(0, 500)
  }, MAX_ERR);
}

// quien: 'dueño' o 'superadmin'. Nunca se guardan contraseñas ni datos de clientes finales.
async function auditar(quien, slug, accion, detalle) {
  await push(K_AUD, { t: new Date().toISOString(), quien, slug: slug || '', accion, detalle: String(detalle || '').slice(0, 200) }, MAX_AUD);
}

async function listar(key, n) {
  try {
    const rows = await redis.cmd('LRANGE', key, 0, (n || 100) - 1);
    return (rows || []).map((r) => { try { return JSON.parse(r); } catch (e) { return null; } }).filter(Boolean);
  } catch (e) { return []; }
}

module.exports = { error, auditar, errores: (n) => listar(K_ERR, n), auditoria: (n) => listar(K_AUD, n) };
