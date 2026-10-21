const crypto = require('crypto');
const DEFAULT = require('./default-config');
const redis = require('./redis');
const img = require('./imagenes');
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

// Turnos de atención: el primero (desde/hasta) y, si el local hace horario partido, un segundo (desde2/hasta2).
function turnos(hr) {
  const t = [{ desde: hr.desde, hasta: hr.hasta }];
  if (hr.desde2 != null && hr.hasta2 != null) t.push({ desde: hr.desde2, hasta: hr.hasta2 });
  return t;
}

// ¿Está abierto el día dow (0 = domingo) a la hora h (decimal)? Sirve para cualquier día y hora.
function abiertoEn(hr, dow, h) {
  return turnos(hr).some(({ desde, hasta }) => {
    if (desde < hasta) return hr.dias.includes(dow) && h >= desde && h < hasta;
    // Turno que cruza la medianoche (por ejemplo 20 a 2).
    return (hr.dias.includes(dow) && h >= desde) || (hr.dias.includes((dow + 6) % 7) && h < hasta);
  });
}

function isOpen(cfg, d) {
  if (cfg.pausado) return false;
  const { dow, h } = nowAR(d);
  return abiertoEn(cfg.horario, dow, h);
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
    const guardado = JSON.parse(raw);
    const c = Object.assign(clone(DEFAULT), guardado);
    // Locales guardados antes de las fotos y etiquetas: se completan los campos nuevos.
    c.menu = (c.menu || []).map((p) => Object.assign({ foto: '', destacado: false, tags: [], variantes: [] }, p));
    // "Take away" se unificó con "retiro": si el local tenía cualquiera de los dos prendido, retira.
    const m = guardado.modos || {};
    c.modos = { retiro: m.retiro !== false || (m.takeaway !== undefined && m.takeaway !== false), delivery: m.delivery !== false };
    if (typeof guardado.elegirHora !== 'boolean') c.elegirHora = m.takeaway !== false;
    c.demora = Object.assign({ retiro: 0, delivery: 0 }, c.demora);
    c.rev = Number.isInteger(guardado.rev) ? guardado.rev : 0;
    // Logos viejos guardados adentro de la configuración: se pasan una sola vez al sistema de fotos.
    try {
      if (await logoLegado(slug, c)) await redis.cmd('SET', redis.tk(slug, 'cfg'), JSON.stringify(Object.assign(guardado, { logo: c.logo })));
    } catch (e) { /* si falla, se reintenta en la próxima lectura */ }
    return c;
  } catch (e) {
    return nuevoConfig(slug);
  }
}

async function saveConfig(slug, cfg) {
  await redis.cmd('SET', redis.tk(slug, 'cfg'), JSON.stringify(cfg));
  // Número de versión aparte: el panel lo consulta en cada vuelta sin bajar todo el menú.
  await redis.cmd('SET', redis.tk(slug, 'cfgrev'), String(cfg.rev || 0));
}

async function getRev(slug) {
  return Number(await redis.cmd('GET', redis.tk(slug, 'cfgrev'))) || 0;
}

// Si el logo llega como imagen embebida (locales viejos o paneles sin actualizar), lo guarda como foto.
async function logoLegado(slug, cfg) {
  if (!/^data:image\//.test(cfg.logo || '')) return false;
  const v = crypto.createHash('sha1').update(cfg.logo).digest('hex').slice(0, 10);
  await img.guardar(imgKey(slug, 'logo'), v, cfg.logo);
  cfg.logo = v;
  return true;
}

// ---- Validación de lo que llega desde el panel ----
const bad = (m) => { throw new Reject(m, 400); };
const ID = /^[A-Za-z0-9_-]{1,24}$/;
const VER = /^[a-f0-9]{10}$/;
const TAGS = ['sintacc', 'veggie', 'picante', 'nuevo'];
const ESTILOS = ['color', 'banner', 'mantel'];
const FUENTES = ['bodegon', 'urbana', 'clasica', 'moderna', 'pizzeria', 'cafe', 'parrilla', 'minimal'];

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
  // Horario partido (opcional): un segundo turno que no se pise con el primero.
  let desde2 = null, hasta2 = null;
  if (h.desde2 != null && h.desde2 !== '' && h.hasta2 != null && h.hasta2 !== '') {
    desde2 = int(h.desde2, 0, 23, 'Apertura del segundo turno');
    hasta2 = int(h.hasta2, 1, 24, 'Cierre del segundo turno');
    if (desde2 === hasta2) bad('En el segundo turno, el cierre no puede ser igual a la apertura.');
    const tramos = (d, h2) => (d < h2 ? [[d, h2]] : [[d, 24], [0, h2]]);
    const a = tramos(desde, hasta), b = tramos(desde2, hasta2);
    if (a.some(([x1, y1]) => b.some(([x2, y2]) => x1 < y2 && x2 < y1))) bad('Los dos turnos de atención se pisan. Cambiá las horas.');
  }

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
    const foto = typeof p.foto === 'string' ? p.foto : '';
    if (foto && !VER.test(foto)) bad('Foto del producto inválida. Volvé a subirla.');
    const tags = Array.isArray(p.tags) ? [...new Set(p.tags.map(String))].filter((t) => TAGS.includes(t)) : [];
    // Tamaños o porciones con precio propio (chica / grande, 8 / 12 porciones). El precio del producto pasa a ser el menor ("desde").
    const nomP = str(p.nom, 60, 'Nombre del producto', true);
    const variantes = Array.isArray(p.variantes) ? list(p.variantes, 8, 'Tamaños de "' + nomP + '"').map((v) => ({
      id: String(v.id), nom: str(v.nom, 30, 'Nombre del tamaño de "' + nomP + '"', true), precio: int(v.precio, 0, 1000000, 'Precio del tamaño de "' + nomP + '"')
    })) : [];
    if (variantes.length === 1) bad('"' + nomP + '": cargá al menos 2 tamaños, o ninguno.');
    uniqueIds(variantes, 'Tamaños de "' + nomP + '"');
    return {
      id: String(p.id), cat: String(p.cat),
      nom: nomP,
      desc: str(p.desc, 160, 'Descripción del producto'),
      precio: variantes.length ? Math.min(...variantes.map((v) => v.precio)) : int(p.precio, 0, 1000000, 'Precio del producto'),
      variantes,
      extras: Boolean(p.extras), off: Boolean(p.off),
      foto, destacado: Boolean(p.destacado), tags
    };
  });
  uniqueIds(menu, 'Productos');

  const color = typeof inp.color === 'string' ? inp.color.trim() : '';
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) bad('Color: elegí un color válido.');
  const logo = typeof inp.logo === 'string' ? inp.logo : '';
  // Normalmente es la versión de la foto subida; se acepta también la imagen embebida de paneles viejos.
  if (logo && !VER.test(logo) && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo) || logo.length > 150000)) bad('Logo: usá una imagen PNG, JPG o WebP más chica.');

  const estilo = ESTILOS.includes(inp.estilo) ? inp.estilo : 'color';
  const banner = typeof inp.banner === 'string' ? inp.banner : '';
  if (banner && !VER.test(banner)) bad('Banner inválido. Volvé a subirlo.');
  const fuente = FUENTES.includes(inp.fuente) ? inp.fuente : 'bodegon';

  const m = inp.modos || {};
  const modos = { retiro: m.retiro !== false, delivery: m.delivery !== false };
  if (!modos.retiro && !(modos.delivery && zonas.length)) bad('Dejá activa al menos una forma de entrega (retiro en el local o delivery con barrios).');

  const d = inp.demora || {};
  const demora = {
    retiro: d.retiro === undefined || d.retiro === '' ? 0 : int(d.retiro, 0, 240, 'Demora para retirar'),
    delivery: d.delivery === undefined || d.delivery === '' ? 0 : int(d.delivery, 0, 240, 'Demora del delivery')
  };

  return {
    color: color.toLowerCase(), logo, estilo, banner, fuente,
    nombre: str(inp.nombre, 40, 'Nombre del local', true),
    descripcion: str(inp.descripcion, 140, 'Descripción'),
    direccion: str(inp.direccion, 120, 'Dirección del local'),
    instagram: str(inp.instagram, 40, 'Instagram').replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, ''),
    anuncio: str(inp.anuncio, 140, 'Aviso destacado'),
    minimo: inp.minimo === undefined || inp.minimo === '' ? 0 : int(inp.minimo, 0, 1000000, 'Pedido mínimo'),
    demora, modos, elegirHora: inp.elegirHora !== false,
    msgListo: str(inp.msgListo, 300, 'Mensaje de pedido listo'),
    msgCamino: str(inp.msgCamino, 300, 'Mensaje de pedido en camino'),
    whatsapp,
    alias: str(inp.alias, 60, 'Alias'),
    pausado: Boolean(inp.pausado),
    horario: { dias, desde, hasta, desde2, hasta2 },
    zonas, extras, categorias, menu
  };
}

// Imágenes que sube el dueño (fotos de productos y banner): se guardan aparte, con versión.
const imgKey = (slug, id) => redis.tk(slug, 'img:' + id);
function imagenesDe(cfg) {
  const out = new Map();
  (cfg.menu || []).forEach((p) => { if (p.foto) out.set(p.id, p.foto); });
  if (cfg.banner) out.set('banner', cfg.banner);
  if (VER.test(cfg.logo || '')) out.set('logo', cfg.logo);
  return out;
}

module.exports = { DEFAULT, nuevoConfig, getConfig, saveConfig, getRev, logoLegado, sanitizeConfig, isOpen, abiertoEn, turnos, nowAR, TZ, imgKey, imagenesDe, ID, VER, FUENTES };
