// Fotos de los platos, banner y logo de cada local, e imágenes de la página de inicio.
// Se guardan en Redis, aparte de la configuración, y el navegador las guarda en caché (la dirección lleva la versión).
const redis = require('./redis');

const DATA = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;

async function guardar(key, v, data) {
  if (!DATA.test(data || '')) throw new Error('imagen_invalida');
  await redis.cmd('SET', key, JSON.stringify({ v, data }));
}

// Devuelve { tipo, bytes } o null.
async function leer(key) {
  const raw = await redis.cmd('GET', key);
  if (!raw) return null;
  const m = DATA.exec(JSON.parse(raw).data || '');
  return m ? { tipo: 'image/' + m[1], bytes: Buffer.from(m[2], 'base64') } : null;
}

async function borrar(keys) {
  if (keys && keys.length) await redis.cmd('DEL', ...keys);
}

module.exports = { guardar, leer, borrar, DATA };
