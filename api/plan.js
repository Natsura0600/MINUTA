const redis = require('../lib/redis');
const { getPlan } = require('../lib/site');
const { send, fail } = require('../lib/http');

// Plan y precio que se muestran en la página inicial (público).
module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method' });
  try {
    if (!redis.enabled()) {
      const e = new Error('storage_not_configured');
      e.code = 'storage_not_configured';
      throw e;
    }
    send(res, 200, { plan: await getPlan() }, 'public, max-age=0, s-maxage=30, stale-while-revalidate=120');
  } catch (e) {
    fail(res, e);
  }
};
