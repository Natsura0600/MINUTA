// Menú de ejemplo. Se usa hasta que el dueño guarda su propio menú desde /admin.
// Si lo cambiás acá, cambiá también DEFAULT_CONFIG en public/index.html (el test lo avisa).
module.exports = {
  nombre: "Smash Luján",
  descripcion: "Hamburguesas smash, hechas al momento. Retirás en el local o te las llevamos.",
  whatsapp: "5491100000000",
  alias: "",
  pausado: false,
  aceptaMP: true,
  horario: { dias: [3, 4, 5, 6, 0], desde: 20, hasta: 24 },
  zonas: [
    { id: "z1", nom: "Centro", costo: 1500 },
    { id: "z2", nom: "Pueblo Nuevo", costo: 2000 },
    { id: "z3", nom: "Parque Ayerza", costo: 2500 },
    { id: "z4", nom: "Open Door", costo: 3000 }
  ],
  extras: [
    { id: "e1", nom: "Extra carne", precio: 2800 },
    { id: "e2", nom: "Panceta", precio: 1500 },
    { id: "e3", nom: "Cheddar", precio: 1000 },
    { id: "e4", nom: "Huevo frito", precio: 1000 },
    { id: "e5", nom: "Papas y gaseosa", precio: 6000 }
  ],
  categorias: [
    { id: "c1", nom: "Hamburguesas" },
    { id: "c2", nom: "Papas" },
    { id: "c3", nom: "Bebidas" }
  ],
  menu: [
    { id: "cla", cat: "c1", nom: "Clásica", desc: "Doble carne smash, cheddar, pickles y salsa de la casa.", precio: 9800, extras: true, off: false },
    { id: "bbq", cat: "c1", nom: "Bacon BBQ", desc: "Doble carne, panceta crocante, cheddar, cebolla caramelizada y BBQ.", precio: 11500, extras: true, off: false },
    { id: "bas", cat: "c1", nom: "La Basílica", desc: "Triple carne, provoleta, huevo, panceta y criolla.", precio: 13800, extras: true, off: false },
    { id: "vegi", cat: "c1", nom: "Veggie", desc: "Medallón de lentejas y garbanzos, rúcula, tomate y mayo de ajo.", precio: 9500, extras: true, off: false },
    { id: "pap", cat: "c2", nom: "Papas clásicas", desc: "Porción grande, con sal marina.", precio: 4500, extras: false, off: false },
    { id: "pch", cat: "c2", nom: "Papas cheddar y panceta", desc: "Bañadas en cheddar con panceta crocante.", precio: 6500, extras: false, off: false },
    { id: "gas", cat: "c3", nom: "Gaseosa", desc: "Línea Coca-Cola, 500 ml.", precio: 2500, extras: false, off: false },
    { id: "cer", cat: "c3", nom: "Cerveza artesanal", desc: "Pinta rubia o IPA, consultá cuál hay.", precio: 4500, extras: false, off: false },
    { id: "agu", cat: "c3", nom: "Agua", desc: "Sin gas, 500 ml.", precio: 1800, extras: false, off: false }
  ]
};
