const crypto = require('crypto');
const redis = require('../lib/redis');
const T = require('../lib/tenants');
const { imgKey, ID } = require('../lib/config');
const { send, fail, body, ip, slugFromReq, requireSuper, Reject } = require('../lib/http');

// Fotos de productos y banner de cada local, e imágenes de tu página de inicio.
// GET es público y se cachea para siempre (la URL lleva la versión).
// PUT / DELETE: el dueño del local para sus fotos, o vos (superadmin) con ?site=1.
const DATA = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;
const SITE_ID = /^[a-z0-9-]{1,24}$/;
const MAX = { producto: 160000, banner: 420000, site: 620000 };

const siteKey = (id) => 'site:img:' + id;

function leer(req) {
  const q = req.query || {};
  return { site: q.site === '1' || q.site === 1, id: String(q.id || '') };
}

module.exports = async (req, res) => {
  try {
    if (!redis.enabled()) {
      const e = new Error('storage_not_configured');
      e.code = 'storage_not_configured';
      throw e;
    }
    const q = leer(req);

    if (req.method === 'GET') {
      let key;
      if (q.site) {
        if (!SITE_ID.test(q.id)) throw new Reject('Imagen no encontrada.', 404);
        key = siteKey(q.id);
      } else {
        const slug = slugFromReq(req);
        if (!slug || !ID.test(q.id)) throw new Reject('Imagen no encontrada.', 404);
        key = imgKey(slug, q.id);
      }
      const raw = await redis.cmd('GET', key);
      if (!raw) throw new Reject('Imagen no encontrada.', 404, 'no_encontrada');
      const { data } = JSON.parse(raw);
      const m = DATA.exec(data || '');
      if (!m) throw new Reject('Imagen no encontrada.', 404);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/' + m[1]);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.end(Buffer.from(m[2], 'base64'));
    }

    if (req.method !== 'PUT' && req.method !== 'DELETE') return send(res, 405, { error: 'method' });
    const b = req.method === 'PUT' ? body(req) : {};
    const id = String(b.id || q.id || '');

    let key, max;
    if (q.site) {
      await requireSuper(req);
      if (!SITE_ID.test(id)) throw new Reject('Identificador de imagen inválido.', 400);
      key = siteKey(id); max = MAX.site;
    } else {
      const tenant = await T.requireTenant(req);
      T.requireOwner(req, tenant);
      if (!ID.test(id)) throw new Reject('Identificador de imagen inválido.', 400);
      if (req.method === 'PUT' && !(await redis.limit('rl:img:' + tenant.slug + ':' + ip(req), 80, 600))) {
        throw new Reject('Subiste muchas fotos seguidas. Esperá unos minutos.', 429, 'demasiados');
      }
      key = imgKey(tenant.slug, id); max = id === 'banner' ? MAX.banner : MAX.producto;
    }

    if (req.method === 'DELETE') {
      await redis.cmd('DEL', key);
      return send(res, 200, { ok: true });
    }

    const data = typeof b.data === 'string' ? b.data : '';
    if (!DATA.test(data)) throw new Reject('Usá una imagen PNG, JPG o WebP.', 400);
    if (data.length > max) throw new Reject('La imagen es muy pesada. Probá con otra más chica.', 400);
    const v = crypto.createHash('sha1').update(data).digest('hex').slice(0, 10);
    await redis.cmd('SET', key, JSON.stringify({ v, data }));
    send(res, 200, { ok: true, id, v });
  } catch (e) {
    fail(res, e);
  }
};
