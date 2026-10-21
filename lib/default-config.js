// Menú de ejemplo. Se usa hasta que el dueño guarda su propio menú desde /admin.
// Si lo cambiás acá, cambiá también DEFAULT_CONFIG en public/app.js (el test lo avisa).
module.exports = {
  nombre: "Bodegón Luján",
  descripcion: "Minutas, pastas y postres caseros. Pasás a retirar o te lo llevamos.",
  whatsapp: "5491100000000",
  alias: "",
  pausado: false,
  color: "#8e1b2c",
  logo: "",
  estilo: "mantel",
  banner: "",
  fuente: "bodegon",
  direccion: "",
  instagram: "",
  anuncio: "",
  minimo: 0,
  demora: { retiro: 25, delivery: 45 },
  modos: { retiro: true, delivery: true },
  msgListo: "",
  msgCamino: "",
  elegirHora: true,
  horario: { dias: [3, 4, 5, 6, 0], desde: 20, hasta: 24, desde2: null, hasta2: null },
  zonas: [
    { id: "z1", nom: "Centro", costo: 1500 },
    { id: "z2", nom: "Pueblo Nuevo", costo: 2000 },
    { id: "z3", nom: "Parque Ayerza", costo: 2500 },
    { id: "z4", nom: "Open Door", costo: 3000 }
  ],
  extras: [
    { id: "e1", nom: "Porción extra de fritas", precio: 2800 },
    { id: "e2", nom: "Huevo frito", precio: 1500 },
    { id: "e3", nom: "Jamón y queso", precio: 1000 },
    { id: "e4", nom: "Salsa criolla", precio: 1000 },
    { id: "e5", nom: "Bebida y postre", precio: 6000 }
  ],
  categorias: [
    { id: "c1", nom: "Minutas" },
    { id: "c2", nom: "Guarniciones" },
    { id: "c3", nom: "Bebidas" }
  ],
  menu: [
    { id: "cla", cat: "c1", nom: "Milanesa napolitana", desc: "Ternera, salsa casera, jamón y muzzarella gratinada. Con fritas.", precio: 9800, extras: true, off: false, foto: "", destacado: true, tags: [] },
    { id: "bbq", cat: "c1", nom: "Milanesa a caballo", desc: "Ternera con dos huevos fritos y papas fritas.", precio: 11500, extras: true, off: false, foto: "", destacado: false, tags: [] },
    { id: "bas", cat: "c1", nom: "Bife de chorizo", desc: "350 g a la parrilla, con ensalada o puré.", precio: 13800, extras: true, off: false, foto: "", destacado: false, tags: ["sintacc"] },
    { id: "vegi", cat: "c1", nom: "Tortilla de papas", desc: "Babé o cocida, con cebolla caramelizada.", precio: 9500, extras: true, off: false, foto: "", destacado: false, tags: ["veggie", "sintacc"] },
    { id: "pap", cat: "c2", nom: "Papas fritas", desc: "Porción grande, cortadas a mano.", precio: 4500, extras: false, off: false, foto: "", destacado: false, tags: ["veggie"] },
    { id: "pch", cat: "c2", nom: "Puré de calabaza", desc: "Con manteca y nuez moscada.", precio: 6500, extras: false, off: false, foto: "", destacado: false, tags: ["veggie", "sintacc"] },
    { id: "gas", cat: "c3", nom: "Gaseosa", desc: "Línea Coca-Cola, 500 ml.", precio: 2500, extras: false, off: false, foto: "", destacado: false, tags: [] },
    { id: "cer", cat: "c3", nom: "Sifón y vino de la casa", desc: "Media jarra de tinto con soda.", precio: 4500, extras: false, off: false, foto: "", destacado: false, tags: [] },
    { id: "agu", cat: "c3", nom: "Agua", desc: "Sin gas, 500 ml.", precio: 1800, extras: false, off: false, foto: "", destacado: false, tags: [] }
  ]
};
