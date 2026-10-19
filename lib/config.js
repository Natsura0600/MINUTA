const DEFAULT = require('./default-config');
const redis = require('./redis');
const { Reject } = require('./http');

const TZ = 'America/Argentina/Buenos_Aires';
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Día y hora en Argentina, sin importar dónde corra el servidor.
function nowAR(d) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
  }).formatToParts(d || new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  return { dow: WD[g('weekday')], h: Number(g('hour')) + Number(g('minute')) / 60 };
}

function isOpen(cfg, d) {
  if (cfg.pausado) return false;
  const { dias, desde, hasta } = cfg.horario;
  const { dow, h } = nowAR(d);
  if (desde < hasta) return dias.includes(dow) && h >= desde && h < hasta;
  // Horario que cruza la medianoche (por ejemplo 20 a 2).
  return (dias.includes(dow) && h >= desde) || (dias.includes((dow + 6) % 7) && h < hasta);
}

const clone = (o) => JSON.parse(JSON.stringify(o));

// Un local nuevo arranca con el menú de ejemplo, sin WhatsApp y con los pedidos pausados,
// para que nadie pida productos de ejemplo antes de que el dueño cargue lo suyo.
function nuevoConfig(nombre) {
  return Object.assign(clone(DEFAULT), { nombre, whatsapp: '', pausado: true });
}

async function getConfig(slug) {
  const raw = await redis.cmd('GET', redis.tk(slug, 'cfg'));
  if (!raw) return nuevoConfig(slug);
  try {
    return Object.assign(clone(DEFAULT), JSON.parse(raw));
  } catch (e) {
    return nuevoConfig(slug);
  }
}

async function saveConfig(slug, cfg) {
  await redis.cmd('SET', redis.tk(slug, 'cfg'), JSON.stringify(cfg));
}

// ---- Validación de lo que llega desde el panel ----
const bad = (m) => { throw new Reject(m, 400); };
const ID = /^[A-Za-z0-9_-]{1,24}$/;

function str(v, max, label, required) {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (required && !s) bad(label + ': no puede quedar vacío.');
  if (s.length > max) bad(label + ': máximo ' + max + ' caracteres.');
  return s;
}

function int(v, min, max, label) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) bad(label + ': ingresá un número entero entre ' + min + ' y ' + max + '.');
  return n;
}

function list(v, max, label) {
  if (!Array.isArray(v)) bad(label + ': formato inválido.');
  if (v.length > max) bad(label + ': máximo ' + max + '.');
  return v;
}

function uniqueIds(items, label) {
  const seen = new Set();
  items.forEach((x) => {
    if (!ID.test(String(x.id)) || seen.has(x.id)) bad(label + ': identificador inválido o repetido.');
    seen.add(x.id);
  });
  return seen;
}

function sanitizeConfig(inp) {
  if (!inp || typeof inp !== 'object') bad('Configuración inválida.');

  const whatsapp = String(inp.whatsapp || '').replace(/\D/g, '');
  if (whatsapp.length < 10 || whatsapp.length > 15) bad('WhatsApp: escribilo con código de país y sin espacios, por ejemplo 5491155550000.');

  const h = inp.horario || {};
  const dias = [...new Set(list(h.dias, 7, 'Días de atención').map((d) => int(d, 0, 6, 'Día')))];
  if (!dias.length) bad('Elegí al menos un día de atención.');
  const desde = int(h.desde, 0, 23, 'Hora de apertura');
  const hasta = int(h.hasta, 1, 24, 'Hora de cierre');
  if (desde === hasta) bad('La hora de cierre no puede ser igual a la de apertura.');

  const categorias = list(inp.categorias, 30, 'Categorías').map((c) => ({
    id: String(c.id), nom: str(c.nom, 40, 'Nombre de categoría', true)
  }));
  if (!categorias.length) bad('Tiene que haber al menos una categoría.');
  const catIds = uniqueIds(categorias, 'Categorías');

  const zonas = list(inp.zonas, 40, 'Barrios de envío').map((z) => ({
    id: String(z.id), nom: str(z.nom, 40, 'Nombre del barrio', true), costo: int(z.costo, 0, 100000, 'Costo de envío')
  }));
  uniqueIds(zonas, 'Barrios de envío');

  const extras = list(inp.extras, 40, 'Extras').map((x) => ({
    id: String(x.id), nom: str(x.nom, 40, 'Nombre del extra', true), precio: int(x.precio, 0, 100000, 'Precio del extra')
  }));
  uniqueIds(extras, 'Extras');

  const menu = list(inp.menu, 200, 'Productos').map((p) => {
    if (!catIds.has(String(p.cat))) bad('Hay un producto sin categoría válida.');
    return {
      id: String(p.id), cat: String(p.cat),
      nom: str(p.nom, 60, 'Nombre del producto', true),
      desc: str(p.desc, 160, 'Descripción del producto'),
      precio: int(p.precio, 0, 1000000, 'Precio del producto'),
      extras: Boolean(p.extras), off: Boolean(p.off)
    };
  });
  uniqueIds(menu, 'Productos');

  const color = typeof inp.color === 'string' ? inp.color.trim() : '';
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) bad('Color: elegí un color válido.');
  const logo = typeof inp.logo === 'string' ? inp.logo : '';
  if (logo && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo) || logo.length > 150000)) bad('Logo: usá una imagen PNG, JPG o WebP más chica.');

  return {
    color: color.toLowerCase(), logo,
    nombre: str(inp.nombre, 40, 'Nombre del local', true),
    descripcion: str(inp.descripcion, 140, 'Descripción'),
    whatsapp,
    alias: str(inp.alias, 60, 'Alias'),
    pausado: Boolean(inp.pausado),
    horario: { dias, desde, hasta },
    zonas, extras, categorias, menu
  };
}

module.exports = { DEFAULT, nuevoConfig, getConfig, saveConfig, sanitizeConfig, isOpen, nowAR, TZ };
