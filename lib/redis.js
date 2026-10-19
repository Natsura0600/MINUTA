// Cliente mínimo para Upstash Redis por REST (el que instala Vercel desde Marketplace).
// Acepta los dos nombres de variables que usa Vercel.
const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const enabled = () => Boolean(url() && token());

async function cmd(...args) {
  if (!enabled()) {
    const e = new Error('storage_not_configured');
    e.code = 'storage_not_configured';
    throw e;
  }
  const r = await fetch(url(), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('redis_error: ' + (j.error || r.status));
  return j.result;
}

// Cuenta intentos por clave en una ventana de tiempo. Si Redis falla, deja pasar.
async function limit(key, max, seconds) {
  try {
    const n = await cmd('INCR', key);
    if (n === 1) await cmd('EXPIRE', key, seconds);
    return n <= max;
  } catch (e) {
    return true;
  }
}

// Clave de un dato de un local. Todo lo de un local vive bajo "t:<local>:".
const tk = (slug, name) => 't:' + slug + ':' + name;

module.exports = { enabled, cmd, limit, tk };
