'use strict';
var DEFAULT_CONFIG={
  "nombre": "Bodegón Luján",
  "descripcion": "Minutas, pastas y postres caseros. Pasás a retirar o te lo llevamos.",
  "whatsapp": "5491100000000",
  "alias": "",
  "pausado": false,
  "color": "#8e1b2c",
  "logo": "",
  "estilo": "mantel",
  "banner": "",
  "fuente": "bodegon",
  "direccion": "",
  "instagram": "",
  "anuncio": "",
  "minimo": 0,
  "demora": {
    "retiro": 25,
    "delivery": 45
  },
  "modos": {
    "retiro": true,
    "delivery": true
  },
  "msgListo": "",
  "msgCamino": "",
  "elegirHora": true,
  "horario": {
    "dias": [
      3,
      4,
      5,
      6,
      0
    ],
    "desde": 20,
    "hasta": 24,
    "desde2": null,
    "hasta2": null
  },
  "zonas": [
    {
      "id": "z1",
      "nom": "Centro",
      "costo": 1500
    },
    {
      "id": "z2",
      "nom": "Pueblo Nuevo",
      "costo": 2000
    },
    {
      "id": "z3",
      "nom": "Parque Ayerza",
      "costo": 2500
    },
    {
      "id": "z4",
      "nom": "Open Door",
      "costo": 3000
    }
  ],
  "extras": [
    {
      "id": "e1",
      "nom": "Porción extra de fritas",
      "precio": 2800
    },
    {
      "id": "e2",
      "nom": "Huevo frito",
      "precio": 1500
    },
    {
      "id": "e3",
      "nom": "Jamón y queso",
      "precio": 1000
    },
    {
      "id": "e4",
      "nom": "Salsa criolla",
      "precio": 1000
    },
    {
      "id": "e5",
      "nom": "Bebida y postre",
      "precio": 6000
    }
  ],
  "categorias": [
    {
      "id": "c1",
      "nom": "Minutas"
    },
    {
      "id": "c2",
      "nom": "Guarniciones"
    },
    {
      "id": "c3",
      "nom": "Bebidas"
    }
  ],
  "menu": [
    {
      "id": "cla",
      "cat": "c1",
      "nom": "Milanesa napolitana",
      "desc": "Ternera, salsa casera, jamón y muzzarella gratinada. Con fritas.",
      "precio": 9800,
      "extras": true,
      "off": false,
      "foto": "",
      "destacado": true,
      "tags": []
    },
    {
      "id": "bbq",
      "cat": "c1",
      "nom": "Milanesa a caballo",
      "desc": "Ternera con dos huevos fritos y papas fritas.",
      "precio": 11500,
      "extras": true,
      "off": false,
      "foto": "",
      "destacado": false,
      "tags": []
    },
    {
      "id": "bas",
      "cat": "c1",
      "nom": "Bife de chorizo",
      "desc": "350 g a la parrilla, con ensalada o puré.",
      "precio": 13800,
      "extras": true,
      "off": false,
      "foto": "",
      "destacado": false,
      "tags": [
        "sintacc"
      ]
    },
    {
      "id": "vegi",
      "cat": "c1",
      "nom": "Tortilla de papas",
      "desc": "Babé o cocida, con cebolla caramelizada.",
      "precio": 9500,
      "extras": true,
      "off": false,
      "foto": "",
      "destacado": false,
      "tags": [
        "veggie",
        "sintacc"
      ]
    },
    {
      "id": "pap",
      "cat": "c2",
      "nom": "Papas fritas",
      "desc": "Porción grande, cortadas a mano.",
      "precio": 4500,
      "extras": false,
      "off": false,
      "foto": "",
      "destacado": false,
      "tags": [
        "veggie"
      ]
    },
    {
      "id": "pch",
      "cat": "c2",
      "nom": "Puré de calabaza",
      "desc": "Con manteca y nuez moscada.",
      "precio": 6500,
      "extras": false,
      "off": false,
      "foto": "",
      "destacado": false,
      "tags": [
        "veggie",
        "sintacc"
      ]
    },
    {
      "id": "gas",
      "cat": "c3",
      "nom": "Gaseosa",
      "desc": "Línea Coca-Cola, 500 ml.",
      "precio": 2500,
      "extras": false,
      "off": false,
      "foto": "",
      "destacado": false,
      "tags": []
    },
    {
      "id": "cer",
      "cat": "c3",
      "nom": "Sifón y vino de la casa",
      "desc": "Media jarra de tinto con soda.",
      "precio": 4500,
      "extras": false,
      "off": false,
      "foto": "",
      "destacado": false,
      "tags": []
    },
    {
      "id": "agu",
      "cat": "c3",
      "nom": "Agua",
      "desc": "Sin gas, 500 ml.",
      "precio": 1800,
      "extras": false,
      "off": false,
      "foto": "",
      "destacado": false,
      "tags": []
    }
  ]
};

var MINUTA_WA='5491152495689';
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var money=function(n){return '$ '+Number(n||0).toLocaleString('es-AR')};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var clone=function(o){return JSON.parse(JSON.stringify(o))};
var ico=function(n,c){return '<svg class="ico'+(c?' '+c:'')+'" aria-hidden="true"><use href="#i-'+n+'"/></svg>'};
var DIAS=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
var TZ='America/Argentina/Buenos_Aires';
var pad=function(n){return (n<10?'0':'')+n+':00'};
var hhmm=function(m){m=((m%1440)+1440)%1440;var h=Math.floor(m/60),x=m%60;return (h<10?'0':'')+h+':'+(x<10?'0':'')+x};
var kk=function(k){return (typeof LOCAL!=='undefined'?LOCAL:'')+':'+k};
/* Una foto que no carga se saca (antes era un onerror en cada imagen: la política de seguridad ya no permite scripts en línea). */
document.addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='IMG'&&t.classList&&t.classList.contains('ph'))t.remove()},true);
var store={get:function(k){try{return localStorage.getItem(kk(k))}catch(e){return null}},set:function(k,v){try{localStorage.setItem(kk(k),v)}catch(e){}},del:function(k){try{localStorage.removeItem(kk(k))}catch(e){}}};
var TAGS={sintacc:'Sin TACC',veggie:'Veggie',picante:'Picante',nuevo:'Nuevo'};
var FONTS={
  bodegon:{n:'Bodegón',f:'"DM Serif Display",Georgia,serif',g:'DM+Serif+Display',w:400,d:'Pizarra de bodegón'},
  urbana:{n:'Urbana',f:'"Bowlby One","Arial Black",sans-serif',g:'Bowlby+One',w:400,d:'Hamburguesas, street food'},
  clasica:{n:'Clásica',f:'"Playfair Display",Georgia,serif',g:'Playfair+Display:wght@700',w:700,d:'Restó, cocina de autor'},
  moderna:{n:'Moderna',f:'"Space Grotesk",system-ui,sans-serif',g:'Space+Grotesk:wght@700',w:700,d:'Sushi, poke, cafetería'},
  pizzeria:{n:'Pizzería',f:'"Lobster",cursive',g:'Lobster',w:400,d:'Pizzas, empanadas'},
  cafe:{n:'Café',f:'"Fraunces",Georgia,serif',g:'Fraunces:opsz,wght@9..144,700',w:700,d:'Pastelería, brunch'},
  parrilla:{n:'Parrilla',f:'"Alfa Slab One",Georgia,serif',g:'Alfa+Slab+One',w:400,d:'Parrilla, rotisería'},
  minimal:{n:'Minimal',f:'"Figtree",system-ui,sans-serif',g:'',w:800,d:'Limpia, para todo'}
};
var MODOS={retiro:{t:'Retiro en el local',s:'Pasás a buscarlo cuando quieras',i:'retiro'},delivery:{t:'Delivery',s:'Te lo llevamos',i:'envio'}};

/* ---------- Horario (hora de Argentina, igual que el servidor) ---------- */
function nowAR(d){
  var parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,weekday:'short',hour:'numeric',minute:'numeric',hourCycle:'h23'}).formatToParts(d||new Date());
  var g=function(t){return parts.filter(function(p){return p.type===t})[0].value};
  return {dow:{Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[g('weekday')],h:Number(g('hour'))+Number(g('minute'))/60};
}
/* Turnos de atención: el primero y, si el local hace horario partido, un segundo. */
function turnos(hr){var t=[{desde:hr.desde,hasta:hr.hasta}];if(hr.desde2!=null&&hr.hasta2!=null)t.push({desde:hr.desde2,hasta:hr.hasta2});return t}
function abiertoEn(hr,dow,h){
  return turnos(hr).some(function(t){
    if(t.desde<t.hasta)return hr.dias.indexOf(dow)>-1&&h>=t.desde&&h<t.hasta;
    return (hr.dias.indexOf(dow)>-1&&h>=t.desde)||(hr.dias.indexOf((dow+6)%7)>-1&&h<t.hasta);
  });
}
function isOpen(cfg){
  if(cfg.pausado)return false;
  var n=nowAR();return abiertoEn(cfg.horario,n.dow,n.h);
}
/* Hasta qué hora está abierto ahora (o null si está cerrado). */
function cierraA(hr){
  var n=nowAR(),r=null;
  turnos(hr).forEach(function(t){
    if(t.desde<t.hasta){if(hr.dias.indexOf(n.dow)>-1&&n.h>=t.desde&&n.h<t.hasta)r=t.hasta}
    else if((hr.dias.indexOf(n.dow)>-1&&n.h>=t.desde)||(hr.dias.indexOf((n.dow+6)%7)>-1&&n.h<t.hasta))r=t.hasta;
  });
  return r;
}
/* "20 hs" o "12 y 20 hs": las horas de apertura de todos los turnos. */
function aperturasTxt(hr){return turnos(hr).map(function(t){return pad(t.desde)}).join(' y ')+' hs'}
function diasTxt(dias){return dias.slice().sort(function(a,b){return ((a+6)%7)-((b+6)%7)}).map(function(x){return DIAS[x].slice(0,3)}).join(', ')}
function hoyAR(d){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ}).format(d||new Date())}

/* ---------- Marca del local ---------- */
function onColor(col){var n=parseInt(col.slice(1),16),lum=(0.299*(n>>16&255)+0.587*(n>>8&255)+0.114*(n&255))/255;return lum>0.6?'#231C19':'#ffffff'}
function okColor(c){return /^#[0-9a-fA-F]{6}$/.test(c||'')?c:'#8e1b2c'}
function cargarFuente(k,el){
  var F=FONTS[k]||FONTS.bodegon;el=el||$('#dispFont');
  if(F.g){var u='https://fonts.googleapis.com/css2?family='+F.g+'&display=swap';if(el.getAttribute('href')!==u)el.setAttribute('href',u)}
  return F;
}
function fotoUrl(id,v){return apiUrl('/api/foto?id='+encodeURIComponent(id)+'&v='+encodeURIComponent(v))}
/* El logo es una foto más (se guarda en caché); los locales viejos podían tenerlo embebido. */
function logoUrl(c){return !c.logo?'':/^data:/.test(c.logo)?c.logo:fotoUrl('logo',c.logo)}
function mapsUrl(dir){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(dir)}

/* ---------- Estado de la tienda ---------- */
var S={cfg:null,api:false,abierto:true,cart:[],suspendido:false};
var apiMode=function(){return S.api};
var LOCAL=(new URLSearchParams(location.search).get('local')||'').toLowerCase().replace(/[^a-z0-9-]/g,'');
function apiUrl(path){if(!LOCAL)return path;return path+(path.indexOf('?')>-1?'&':'?')+'local='+encodeURIComponent(LOCAL)}
var isAdminRoute=location.pathname.replace(/\/+$/,'')==='/admin'||location.hash==='#admin';
function modosDe(c){var m=c.modos||{};return {retiro:m.retiro!==false||m.takeaway===true,delivery:m.delivery!==false&&c.zonas.length>0}}
function eligeHora(c){return c.elegirHora!==false}
function conTamanos(p){return !!(p.variantes&&p.variantes.length)}
function precioTxt(p){return (conTamanos(p)?'Desde ':'')+money(p.precio)}

/* El servidor deja el menú dentro de la página (bloque de datos JSON); se usa una sola vez. */
function leerBoot(){var el=document.getElementById('boot');if(!el)return null;var t=el.textContent;el.remove();try{return JSON.parse(t)}catch(e){return null}}
async function cargarConfig(fresh){
  try{
    /* La primera carga ya viene incluida en la página (el servidor la agrega): se evita una consulta más. */
    var b0=!fresh&&leerBoot();
    if(b0){
      if(b0.config&&Array.isArray(b0.config.menu)){S.cfg=b0.config;S.api=!!b0.storage;S.abierto=!!b0.abierto;S.suspendido=!!b0.suspendido;S.storage=!!b0.storage;S.hasApi=true;return 'ok'}}
    var r=await fetch(apiUrl('/api/menu'+(fresh?'?fresh=1':'')),{headers:{accept:'application/json'}});
    if(r.status===404){var j0=await r.json().catch(function(){return null});if(j0&&j0.error==='local_no_encontrado')return 'nolocal'}
    if(r.ok){
      var j=await r.json();
      if(j&&j.landing)return 'landing';
      if(j&&j.config&&Array.isArray(j.config.menu)){
        S.cfg=j.config;S.api=!!j.storage;S.abierto=!!j.abierto;S.suspendido=!!j.suspendido;S.storage=!!j.storage;S.hasApi=true;
        return 'ok';
      }
    }else if(r.status>=500)return 'error';
  }catch(e){}
  /* Sin servidor (vista previa): menú de ejemplo y pedidos solo por WhatsApp. */
  S.cfg=clone(DEFAULT_CONFIG);S.api=false;S.suspendido=false;S.abierto=isOpen(S.cfg);S.hasApi=false;
  return 'demo';
}

function renderEstado(){
  var c=S.cfg,h=c.horario,m=[];
  var txt=S.suspendido?'No toma pedidos por ahora':S.abierto?'Abierto · cierra '+pad((cierraA(h)||h.hasta)%24):(c.pausado?'Hoy no toma pedidos':'Cerrado · abre '+aperturasTxt(h)+' ('+diasTxt(h.dias)+')');
  m.push('<span class="chip '+(S.abierto&&!S.suspendido?'on':'off')+'">'+ico(S.abierto?'listo':'reloj')+esc(txt)+'</span>');
  if(c.direccion)m.push('<a class="chip" target="_blank" rel="noopener" href="'+esc(mapsUrl(c.direccion))+'">'+ico('pin')+esc(c.direccion)+'</a>');
  if(c.instagram)m.push('<a class="chip" target="_blank" rel="noopener" href="https://instagram.com/'+esc(c.instagram)+'">'+ico('ig')+'@'+esc(c.instagram)+'</a>');
  $('#meta').innerHTML=m.join('');
  var md=modosDe(c),d=c.demora||{},mi=[];
  if(md.retiro)mi.push('<span>'+ico('retiro')+'Retiro en el local'+(d.retiro?' · '+d.retiro+' min':'')+'</span>');
  if(md.delivery)mi.push('<span>'+ico('envio')+'Delivery'+(d.delivery?' · '+d.delivery+' min':'')+'</span>');
  if(c.minimo)mi.push('<span>Mínimo '+money(c.minimo)+'</span>');
  $('#modosInfo').innerHTML=mi.join('');
}

function tagsHtml(p){
  var t=(p.tags||[]).map(function(k){return TAGS[k]?'<span class="tag '+k+'">'+TAGS[k]+'</span>':''}).join('');
  return t?'<div class="tags">'+t+'</div>':'';
}
function agot(p){return !!p.off||p.quedan===0}
function quedanTxt(p){return Number.isInteger(p.quedan)&&p.quedan>0&&p.quedan<=10?'Quedan '+p.quedan:''}
function cardHtml(p){
  var img=p.foto&&apiMode()?'<img class="ph" loading="lazy" decoding="async" alt="" src="'+esc(fotoUrl(p.id,p.foto))+'">':'';
  return '<button type="button" class="card'+(agot(p)?' off':'')+'" data-add="'+esc(p.id)+'"'+(agot(p)?' disabled':'')+'><div><h3>'+esc(p.nom)+'</h3>'+(p.desc?'<p>'+esc(p.desc)+'</p>':'')+tagsHtml(p)+
    '<div class="row"><span class="price">'+precioTxt(p)+'</span>'+(agot(p)?'<span class="badge">Hoy no hay</span>':(quedanTxt(p)?'<span class="badge low">'+quedanTxt(p)+'</span>':'')+'<span class="btn sm add">+ Agregar</span>')+'</div></div>'+img+'</button>';
}
function renderMenu(){
  var c=S.cfg,html='',cats='';
  var dest=c.menu.filter(function(p){return p.destacado&&!agot(p)});
  if(dest.length){
    html+='<section class="sec" id="sec-dest"><h2 class="disp">Recomendados</h2><div class="dests">'+dest.map(function(p){
      var img=p.foto&&apiMode()?'<img class="ph" loading="lazy" decoding="async" alt="" src="'+esc(fotoUrl(p.id,p.foto))+'">':'';
      return '<button type="button" class="card" data-add="'+esc(p.id)+'">'+img+'<div><h3>'+esc(p.nom)+'</h3><div class="row"><span class="price">'+precioTxt(p)+'</span><span class="btn sm add">+ Agregar</span></div></div></button>';
    }).join('')+'</div></section>';
    cats+='<a href="#sec-dest">Recomendados</a>';
  }
  c.categorias.forEach(function(cat){
    var items=c.menu.filter(function(p){return p.cat===cat.id});
    if(!items.length)return;
    html+='<section class="sec" id="sec-'+esc(cat.id)+'"><h2 class="disp">'+esc(cat.nom)+'</h2><div class="grid">'+items.map(cardHtml).join('')+'</div></section>';
    cats+='<a href="#sec-'+esc(cat.id)+'">'+esc(cat.nom)+'</a>';
  });
  $('#menu').innerHTML=html;
  $('#catsIn').innerHTML=cats;$('#cats').hidden=!cats;
  espiarCategorias();
}
var spy=null;
function espiarCategorias(){
  if(spy)spy.disconnect();if(!('IntersectionObserver' in window))return;
  spy=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){$$('#catsIn a').forEach(function(a){var on=a.getAttribute('href')==='#'+e.target.id;a.classList.toggle('now',on);if(on&&a.scrollIntoView)a.parentNode.scrollTo({left:a.offsetLeft-16,behavior:'smooth'})})}})},{rootMargin:'-70px 0px -70% 0px'});
  $$('.sec').forEach(function(s){spy.observe(s)});
}

function aplicarMarca(c){
  var col=okColor(c.color),on=onColor(col),st=document.documentElement.style;
  st.setProperty('--acc',col);st.setProperty('--onacc',on);
  var F=cargarFuente(c.fuente);st.setProperty('--disp',F.f);st.setProperty('--dispw',F.w);
  var hd=$('#hd'),est=c.estilo||'color';
  if(est==='banner'&&!(c.banner&&apiMode()))est='color';
  hd.className='hd e-'+est;
  $('#hdBg').style.backgroundImage=est==='banner'?'url("'+fotoUrl('banner',c.banner)+'")':'';
  var lg=$('#logo');if(c.logo){lg.src=logoUrl(c);lg.hidden=false}else{lg.hidden=true;lg.removeAttribute('src')}
  $('#placa').className='placa '+(c.logo?'conlogo':'sinlogo');
  var mt=document.querySelector('meta[name=theme-color]');if(!mt){mt=document.createElement('meta');mt.name='theme-color';document.head.appendChild(mt)}mt.content=col;
}
function pintarTienda(){
  var c=S.cfg;aplicarMarca(c);
  $('#nombre').textContent=c.nombre;
  $('#desc').textContent=c.descripcion||'';
  document.title=c.nombre+' · Pedí online';
  var an=$('#anuncio');an.hidden=!c.anuncio;an.textContent=c.anuncio||'';
  $('#pie').innerHTML=esc(apiMode()?'Tu pedido le llega al local al instante y vas a poder ver cómo avanza.':'Tu pedido se envía por WhatsApp al local y te lo confirman con el tiempo de espera.')+
    '<br><a href="/terminos">Términos</a> · <a href="/privacidad">Privacidad</a> · <a href="/arrepentimiento">Botón de arrepentimiento</a>'+
    '<br><a class="by" href="/inicio"><img src="/brand/minuta-mark.svg" alt="">Pedidos con Minuta</a>';
  var zsel=$('#cZona').value;
  $('#cZona').innerHTML=c.zonas.map(function(z){return '<option value="'+esc(z.id)+'">'+esc(z.nom)+' (+'+money(z.costo)+')</option>'}).join('');
  if(zsel&&c.zonas.some(function(z){return z.id===zsel}))$('#cZona').value=zsel;
  pintarModos();
  renderEstado();renderMenu();normalizeCart();renderCart();
}
function pintarModos(){
  var md=modosDe(S.cfg),d=S.cfg.demora||{},prev=(document.querySelector('input[name=modo]:checked')||{}).value;
  var keys=Object.keys(MODOS).filter(function(k){return md[k]});
  if(keys.indexOf(prev)<0)prev=keys[0];
  $('#modoOpts').innerHTML=keys.map(function(k){
    var M=MODOS[k],ex=k==='delivery'?'Según barrio':d.retiro?'~'+d.retiro+' min':'Sin costo';
    if(k==='retiro'&&eligeHora(S.cfg))M={t:M.t,s:'Elegís a qué hora pasás',i:M.i};
    return '<label class="opt"><input type="radio" name="modo" value="'+k+'"'+(k===prev?' checked':'')+'><span class="ic">'+ico(M.i)+'</span><span><b>'+M.t+'</b><small>'+M.s+'</small></span><span class="mono" style="font-size:13px">'+ex+'</span></label>';
  }).join('');
  pintarHoras();
}
function pintarHoras(){
  var c=S.cfg,n=nowAR(),d=(c.demora&&c.demora.retiro)||20,sel=$('#cHora').value;
  /* Cada 15 minutos desde ahora + demora, solo en horas en que el local está abierto (sirve para horario partido). */
  var base=Math.ceil((n.h*60+d)/15)*15;
  var o='<option value="">Lo antes posible</option>';
  for(var m=base,i=0;m<base+1440&&i<48;m+=15){
    var dia=m>=1440?(n.dow+1)%7:n.dow,hh=(m%1440)/60;
    if(!abiertoEn(c.horario,dia,hh))continue;
    o+='<option value="'+hhmm(m%1440)+'">'+hhmm(m%1440)+' hs</option>';i++;
  }
  $('#cHora').innerHTML=o;if(sel)$('#cHora').value=sel;
}

/* Mantiene al día si el local está abierto, sin molestar si el cliente está armando el pedido. */
async function refrescar(){
  if($('#dPed').open||$('#dProd').open||$('#dOk').open||$('#dTrack').open||document.visibilityState!=='visible')return;
  if(S.hasApi){if((await cargarConfig(false))==='ok')pintarTienda()}
  else{S.abierto=isOpen(S.cfg);renderEstado();renderCart()}
}

/* ---------- Carrito ---------- */
var prod=function(id){return S.cfg.menu.filter(function(p){return p.id===id})[0]};
var extraById=function(id){return S.cfg.extras.filter(function(x){return x.id===id})[0]};
function saveCart(){store.set('cart2',JSON.stringify(S.cart))}
function loadCart(){try{var c=JSON.parse(store.get('cart2')||'[]');return Array.isArray(c)?c:[]}catch(e){return[]}}
function lines(){
  return S.cart.map(function(i,idx){
    var p=prod(i.pid);if(!p||agot(p))return null;
    var unit=p.precio,names=[],vn='';
    if(conTamanos(p)){var v=p.variantes.filter(function(x){return x.id===i.vid})[0];if(!v)return null;unit=v.precio;vn=v.nom}
    for(var k=0;k<i.ex.length;k++){var x=extraById(i.ex[k]);if(!x)return null;unit+=x.precio;names.push(x.nom)}
    return {i:i,idx:idx,p:p,unit:unit,names:names,vn:vn};
  }).filter(Boolean);
}
function normalizeCart(){
  var ok=lines().map(function(l){return l.i});
  if(S.cart.length-ok.length>0){S.cart=ok;saveCart();var n=$('#cNotaCarrito');n.textContent='Quitamos de tu pedido algunos productos que ya no están disponibles.';n.hidden=false}
}
function addItem(pid,ex,nota,vid){
  ex=ex.slice().sort();vid=vid||'';
  var f=S.cart.filter(function(i){return i.pid===pid&&i.ex.join()===ex.join()&&i.nota===nota&&(i.vid||'')===vid})[0];
  if(f)f.qty++;else S.cart.push({pid:pid,ex:ex,nota:nota,vid:vid,qty:1});
  saveCart();renderCart();
  var b=$('#bar');b.classList.remove('bump');void b.offsetWidth;b.classList.add('bump');
}
function sub(){return lines().reduce(function(s,l){return s+l.unit*l.i.qty},0)}
function modo(){var r=document.querySelector('input[name=modo]:checked');return r?r.value:'retiro'}
function zonaSel(){return S.cfg.zonas.filter(function(z){return z.id===$('#cZona').value})[0]}
function envio(){if(modo()!=='delivery')return 0;var z=zonaSel();return z?z.costo:0}
function pago(){return $('input[name=pago]:checked').value}

function renderCart(){
  var ls=lines(),n=ls.reduce(function(s,l){return s+l.i.qty},0);
  $('#bar').hidden=!n;
  $('#bar').textContent='Ver pedido ('+n+') · '+money(sub());
  $('#lista').innerHTML=ls.length?ls.map(function(l){
    var det=[];if(l.names.length)det.push('Extras: '+l.names.join(', '));if(l.i.nota)det.push('Nota: '+l.i.nota);
    return '<div class="ci"><b>'+esc(l.p.nom)+(l.vn?' <span class="mute">· '+esc(l.vn)+'</span>':'')+'</b><div class="q"><button data-m="'+l.idx+'" aria-label="Quitar uno">−</button><span class="mono">'+l.i.qty+'</span><button data-p="'+l.idx+'" aria-label="Sumar uno">+</button></div><small>'+esc(det.join(' · '))+(det.length?' · ':'')+'<span class="mono">'+money(l.unit*l.i.qty)+'</span></small></div>';
  }).join(''):'<p class="note">Todavía no agregaste nada. Elegí algo del menú.</p>';
  $('#dirBox').hidden=modo()!=='delivery';
  $('#horaBox').hidden=modo()!=='retiro'||!eligeHora(S.cfg);
  $('#cambioBox').hidden=pago()!=='efectivo';
  var tn=$('#tNota');
  if(pago()==='transferencia'){tn.hidden=false;tn.textContent=apiMode()?'Cuando el local reciba tu pedido te escribe por WhatsApp con el alias para que transfieras.':(S.cfg.alias?'Alias para transferir: '+S.cfg.alias+'. Mandá el comprobante por WhatsApp.':'Te pasamos el alias por WhatsApp para que transfieras.')}else tn.hidden=true;
  var t=sub()+envio(),falta=S.cfg.minimo&&sub()<S.cfg.minimo;
  $('#tSub').textContent=money(sub());$('#tEnv').textContent=envio()?money(envio()):'—';$('#tTot').textContent=money(t);
  var mn=$('#minNota');mn.hidden=!falta;mn.textContent=falta?'El pedido mínimo es de '+money(S.cfg.minimo)+'. Te faltan '+money(S.cfg.minimo-sub())+'.':'';
  var b=$('#enviar'),cerrado=apiMode()&&!S.abierto;
  b.disabled=cerrado||!ls.length||!!falta;
  b.textContent=cerrado?'El local está cerrado':apiMode()?'Confirmar pedido · '+money(t):'Enviar pedido por WhatsApp';
  $('#pieEnviar').textContent=apiMode()?'El local recibe tu pedido al instante y te avisa por WhatsApp. Acá vas a ver cómo avanza.':'Al tocar el botón se abre WhatsApp con tu pedido ya escrito. Solo falta enviarlo.';
}

/* ---------- Producto con extras ---------- */
var cur=null;
function varSel(){var r=document.querySelector('#pVars input:checked');return r?r.value:''}
function calcProd(){
  var t=cur.precio;
  if(conTamanos(cur)){var v=cur.variantes.filter(function(x){return x.id===varSel()})[0];if(v)t=v.precio}
  $$('#pExtras input:checked').forEach(function(c){var x=extraById(c.value);if(x)t+=x.precio});
  $('#pAdd').textContent='Agregar al pedido · '+money(t);
}
$('#menu').addEventListener('click',function(e){
  var el=e.target.closest('[data-add]');if(!el)return;
  var p=prod(el.getAttribute('data-add'));if(!p||agot(p))return;
  var hasEx=p.extras&&S.cfg.extras.length;
  if(!hasEx&&!conTamanos(p)&&!p.foto&&!p.desc){addItem(p.id,[],'');return}
  cur=p;$('#pNom').textContent=p.nom;$('#pDesc').textContent=p.desc;$('#pNota').value='';
  $('#pTags').innerHTML=tagsHtml(p).replace(/^<div class="tags">|<\/div>$/g,'');
  var im=$('#pImg');if(p.foto&&apiMode()){im.src=fotoUrl(p.id,p.foto);im.hidden=false}else{im.hidden=true;im.removeAttribute('src')}
  $('#pVarFs').hidden=!conTamanos(p);
  $('#pVars').innerHTML=conTamanos(p)?p.variantes.map(function(v,k){return '<label class="o"><span><input type="radio" name="pvar" value="'+esc(v.id)+'"'+(k===0?' checked':'')+'> '+esc(v.nom)+'</span><span class="mono">'+money(v.precio)+'</span></label>'}).join(''):'';
  $('#pExFs').hidden=!hasEx;
  $('#pExtras').innerHTML=hasEx?S.cfg.extras.map(function(x){return '<label class="o"><span><input type="checkbox" value="'+esc(x.id)+'"> '+esc(x.nom)+'</span><span class="mono">+'+money(x.precio)+'</span></label>'}).join(''):'';
  calcProd();$('#dProd').showModal();
});
$('#dProd').addEventListener('change',calcProd);
$('#pAdd').addEventListener('click',function(){
  addItem(cur.id,$$('#pExtras input:checked').map(function(c){return c.value}),$('#pNota').value.trim(),conTamanos(cur)?varSel():'');
  $('#dProd').close();
});
$$('[data-close]').forEach(function(b){b.addEventListener('click',function(){b.closest('dialog').close()})});
$('#lista').addEventListener('click',function(e){
  var t=e.target.closest('button');if(!t)return;
  var m=t.getAttribute('data-m'),p=t.getAttribute('data-p');
  if(p!==null)S.cart[p].qty++;
  if(m!==null&&--S.cart[m].qty<1)S.cart.splice(m,1);
  saveCart();renderCart();if(!S.cart.length)$('#dPed').close();
});
$('#bar').addEventListener('click',function(){$('#err').textContent='';pintarHoras();$('#dPed').showModal()});
$('#dPed').addEventListener('change',renderCart);

/* ---------- Pantalla de confirmación ---------- */
function showOk(titulo,texto,botones){
  $('#okTit').textContent=titulo;$('#okTxt').textContent=texto;
  $('#okAcc').innerHTML=botones.map(function(b,i){
    var cls='btn block'+(b.ghost?' ghost':'');
    return b.href?'<a class="'+cls+'" href="'+esc(b.href)+'" target="_blank" rel="noopener">'+esc(b.txt)+'</a>':'<button class="'+cls+'" data-ok="'+i+'">'+esc(b.txt)+'</button>';
  }).join('');
  $$('#okAcc [data-ok]').forEach(function(el){el.onclick=function(){botones[+el.getAttribute('data-ok')].fn()}});
  if(!$('#dOk').open)$('#dOk').showModal();
}
var cerrarOk=function(){$('#dOk').close()};
function waUrl(texto){return 'https://wa.me/'+S.cfg.whatsapp+'?text='+encodeURIComponent(texto)}
function entregaTxt(){
  var m=modo(),z=zonaSel();
  if(m==='delivery')return 'Entrega: delivery a '+$('#cDir').value.trim()+', '+(z?z.nom:'');
  var hr=eligeHora(S.cfg)&&$('#cHora').value;
  return 'Entrega: retiro en el local'+(hr?' – paso a las '+hr:eligeHora(S.cfg)?' – lo antes posible':'');
}
function mensaje(numero,pagoTxt){
  var L=['*Pedido nuevo'+(numero?' #'+numero:'')+' – '+S.cfg.nombre+'*',''];
  lines().forEach(function(l){
    L.push(l.i.qty+'x '+l.p.nom+(l.vn?' ('+l.vn+')':'')+' – '+money(l.unit*l.i.qty));
    var det=[];if(l.names.length)det.push('Extras: '+l.names.join(', '));if(l.i.nota)det.push('Nota: '+l.i.nota);
    if(det.length)L.push('   '+det.join(' · '));
  });
  var z=zonaSel(),d=modo()==='delivery';
  L.push('','Subtotal: '+money(sub()));
  if(d&&z)L.push('Envío ('+z.nom+'): '+money(envio()));
  L.push('*Total: '+money(sub()+envio())+'*','',entregaTxt());
  L.push('Nombre: '+$('#cNom').value.trim(),'Teléfono: '+$('#cTel').value.trim(),'Pago: '+pagoTxt);
  if(pago()==='efectivo'&&$('#cCambio').value.trim())L.push('Abona con: $'+$('#cCambio').value.trim());
  if($('#cNota').value.trim())L.push('Notas: '+$('#cNota').value.trim());
  if(!apiMode()&&!S.abierto)L.push('','(Pedido enviado con el local cerrado, para cuando abran)');
  return L.join('\n');
}
function vaciar(){S.cart=[];saveCart();renderCart()}

/* ---------- Enviar el pedido ---------- */
/* Cada intento de pedido lleva una clave. Si se corta la conexión o se toca dos veces "Enviar", el servidor reconoce
   la clave y devuelve el mismo pedido en lugar de crear otro. Se renueva cuando cambia el pedido o pasan 10 minutos. */
function claveDePedido(sig){
  try{var c=JSON.parse(store.get('clave')||'null');if(c&&c.sig===sig&&Date.now()-c.t<600000)return c.k}catch(e){}
  var k=(window.crypto&&crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2)+Date.now().toString(36)).replace(/[^A-Za-z0-9_-]/g,'');
  while(k.length<20)k+=Math.floor(Math.random()*36).toString(36);
  store.set('clave',JSON.stringify({k:k,sig:sig,t:Date.now()}));return k;
}
$('#enviar').addEventListener('click',async function(){
  var d=modo()==='delivery',err='',ls=lines();
  if(!ls.length)err='Agregá al menos un producto.';
  else if($('#cNom').value.trim().length<2)err='Escribí tu nombre.';
  else if($('#cTel').value.replace(/\D/g,'').length<8)err='Escribí un teléfono válido para avisarte.';
  else if(d&&!$('#cDir').value.trim())err='Escribí la dirección de entrega.';
  $('#err').textContent=err;if(err)return;
  var P=pago(),pagoTxt={efectivo:'Efectivo',transferencia:'Transferencia'}[P];
  if(!apiMode()){
    var a=document.createElement('a');
    a.href=waUrl(mensaje(0,pagoTxt));a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
    vaciar();$('#dPed').close();return;
  }
  var b=$('#enviar');b.disabled=true;b.textContent='Enviando…';
  var payload={
    items:ls.map(function(l){return {id:l.i.pid,vid:l.i.vid||'',qty:l.i.qty,extras:l.i.ex,nota:l.i.nota}}),
    modo:modo(),zona:d?$('#cZona').value:'',dir:d?$('#cDir').value.trim():'',hora:modo()==='retiro'&&eligeHora(S.cfg)?$('#cHora').value:'',
    cliente:{nombre:$('#cNom').value.trim(),tel:$('#cTel').value.trim()},
    pago:P,cambio:$('#cCambio').value.trim(),nota:$('#cNota').value.trim(),web:$('#cWeb').value
  };
  payload.clave=claveDePedido(JSON.stringify([payload.items,payload.modo,payload.zona,payload.hora,payload.cliente.tel,payload.pago]));
  store.set('cliente',JSON.stringify({n:payload.cliente.nombre,t:payload.cliente.tel,d:$('#cDir').value.trim()}));
  var data=null;
  try{
    var r=await fetch(apiUrl('/api/checkout'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    data=await r.json().catch(function(){return null});
    if(!r.ok||!data||!data.ok){
      $('#err').textContent=(data&&data.mensaje)||'No pudimos enviar el pedido. Probá de nuevo.';
      if(r.status===409||(data&&/actualiz/i.test(data.mensaje||''))){await cargarConfig(true);pintarTienda()}
      if(data&&/hora/i.test(data.mensaje||''))pintarHoras();
      renderCart();return;
    }
  }catch(e){$('#err').textContent='No pudimos conectar. Revisá tu internet y tocá Enviar de nuevo: aunque el primer envío haya llegado, no se duplica.';renderCart();return}
  store.set('track',JSON.stringify({id:data.id,numero:data.numero}));store.del('clave');
  vaciar();$('#dPed').close();
  abrirSeguimiento(data.id,data.numero,true);
});

/* ---------- Seguimiento del pedido ---------- */
var TK={id:null,numero:0,timer:null,last:null};
var FINAL={entregado:1,cancelado:1};
function pasosDe(m){
  var p=[['nuevo','Recibimos tu pedido'],['preparando','En preparación'],['listo',m==='delivery'?'Listo, sale en un momento':'Listo para retirar']];
  if(m==='delivery')p.push(['en_camino','En camino']);
  p.push(['entregado','Entregado']);
  return p;
}
function pintarSeguimiento(o,primera){
  var pasos=pasosDe(o.modo),ix=pasos.map(function(x){return x[0]}).indexOf(o.estado);
  $('#tkNum').textContent='Pedido #'+String(o.numero).padStart(4,'0');
  var tit={nuevo:'Pedido recibido',preparando:'Ya está en la plancha',listo:o.modo==='delivery'?'Ya está listo':'¡Listo para retirar!',en_camino:'Va en camino',entregado:'Entregado. Buen provecho.',cancelado:'El local rechazó el pedido'}[o.estado]||'Pedido recibido';
  $('#tkTit').textContent=tit;
  var tx='Esta pantalla se actualiza sola.';
  if(o.estado==='nuevo'&&o.pago.metodo==='transferencia')tx='El local te va a escribir por WhatsApp con el alias para transferir. Ahí mismo le mandás el comprobante.';
  else if(o.estado==='nuevo')tx='El local ya lo tiene y te escribe por WhatsApp para confirmarlo. Pagás en efectivo al recibirlo.';
  else if(o.estado==='cancelado')tx=o.motivo?'Motivo: '+o.motivo+'. Si querés, escribile al local por WhatsApp.':'Escribile al local por WhatsApp para saber qué pasó.';
  else if(o.pago.metodo==='transferencia'&&!o.pago.pagado&&!FINAL[o.estado])tx='Acordate de transferir y mandar el comprobante por WhatsApp. Esta pantalla se actualiza sola.';
  if(o.modo==='retiro'&&o.hora&&!FINAL[o.estado]&&o.estado!=='nuevo')tx='Te esperamos a las '+o.hora+' hs. '+tx;
  $('#tkTxt').textContent=tx;
  $('#tkSteps').innerHTML=o.estado==='cancelado'?'':pasos.map(function(p,i){
    var cls=i<ix?'done':i===ix?(FINAL[o.estado]?'done':'now'):'';
    return '<li class="'+cls+'"><i>'+(cls==='done'?'✓':(i+1))+'</i><span>'+esc(p[1])+'</span></li>';
  }).join('');
  var acc='<a class="btn block wa" target="_blank" rel="noopener" href="'+esc(waUrl('Hola! Te escribo por mi pedido #'+o.numero+'.'))+'">'+ico('wa')+'Escribir al local</a>';
  if(FINAL[o.estado])acc+='<button class="btn block ghost" id="tkNuevo">Hacer otro pedido</button>';
  $('#tkAcc').innerHTML=acc;
  var nb=$('#tkNuevo');if(nb)nb.onclick=function(){store.del('track');$('#dTrack').close();pintarChip(null)};
  if(TK.last&&TK.last!==o.estado&&!primera&&!FINAL[o.estado]){try{if(navigator.vibrate)navigator.vibrate(120)}catch(e){}}
  TK.last=o.estado;
}
async function pedirEstado(id){
  var r=await fetch(apiUrl('/api/order?id='+encodeURIComponent(id)));
  if(r.status===404)return 'gone';
  if(!r.ok)return null;
  return r.json();
}
async function abrirSeguimiento(id,numero,primera){
  TK.id=id;TK.numero=numero||0;TK.last=null;
  clearInterval(TK.timer);
  var o=null;try{o=await pedirEstado(id)}catch(e){}
  if(o==='gone'){store.del('track');pintarChip(null);showOk('No encontramos ese pedido','Puede que el link esté vencido. Escribile al local por WhatsApp.',[{txt:'Escribir al local',href:waUrl('Hola! Quiero consultar por un pedido.')},{txt:'Cerrar',ghost:true,fn:cerrarOk}]);return}
  if(!o){$('#tkNum').textContent='Tu pedido';$('#tkTit').textContent='No pudimos ver el estado';$('#tkTxt').textContent='Revisá tu internet y probá de nuevo.';$('#tkSteps').innerHTML='';$('#tkAcc').innerHTML='<button class="btn block" id="tkRe">Reintentar</button>';$('#tkRe').onclick=function(){abrirSeguimiento(id,numero)}}
  else{pintarSeguimiento(o,primera);pintarChip(o)}
  if(!$('#dTrack').open)$('#dTrack').showModal();
  TK.timer=setInterval(async function(){
    if(!$('#dTrack').open){clearInterval(TK.timer);return}
    try{var x=await pedirEstado(TK.id);if(x&&x!=='gone'){pintarSeguimiento(x);pintarChip(x);if(FINAL[x.estado])clearInterval(TK.timer)}}catch(e){}
  },8000);
}
function pintarChip(o){
  var b=$('#miPedido');
  if(!o||FINAL[o.estado]){b.hidden=true;return}
  b.hidden=false;b.innerHTML=ico('comanda')+'Mi pedido #'+o.numero+' · '+({nuevo:'recibido',preparando:'en preparación',listo:'listo',en_camino:'en camino'}[o.estado]||'');
}
$('#miPedido').addEventListener('click',function(){var t=null;try{t=JSON.parse(store.get('track')||'null')}catch(e){}if(t)abrirSeguimiento(t.id,t.numero)});
async function revisarPedidoGuardado(){
  var t=null;try{t=JSON.parse(store.get('track')||'null')}catch(e){}
  if(!t||!apiMode())return;
  try{var o=await pedirEstado(t.id);if(o==='gone'||(o&&FINAL[o.estado])){store.del('track');pintarChip(null)}else if(o)pintarChip(o)}catch(e){}
}
function recordarCliente(){try{var c=JSON.parse(store.get('cliente')||'null');if(c){$('#cNom').value=c.n||'';$('#cTel').value=c.t||'';$('#cDir').value=c.d||''}}catch(e){}}

var toastT=null;
/* Aviso corto arriba. Con "act" muestra un botón (por ejemplo, Deshacer). */
function toast(m,act){
  var t=$('.toast');if(!t){t=document.createElement('div');t.className='toast';t.setAttribute('role','status');document.body.appendChild(t)}
  t.textContent=m;
  var acts=!act?[]:Array.isArray(act)?act:[act];
  acts.forEach(function(a){var b=document.createElement('button');b.type='button';b.textContent=a.txt;b.onclick=function(){t.hidden=true;a.fn()};t.appendChild(b)});
  act=acts.length;
  t.hidden=false;t.style.animation='none';void t.offsetWidth;t.style.animation='';clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true},act?6000:2600);
}
/* ---------- Arranque ---------- */
(async function init(){
  if(isAdminRoute){
    /* El panel es un archivo aparte: solo lo baja quien entra a /admin. */
    $('#tienda').hidden=true;$('#admin').hidden=false;document.title='Panel del local · Minuta';
    await new Promise(function(ok,ko){var sc=document.createElement('script');sc.src='/admin.js?v=1';sc.onload=ok;sc.onerror=ko;document.head.appendChild(sc)}).then(function(){adminInit()},function(){
      $('#aLogin').innerHTML='<div class="login"><h1>No pudimos abrir el panel</h1><p class="mute">Revisá tu conexión y <a href="">probá de nuevo</a>.</p></div>'});
    return;
  }
  var st=await cargarConfig(false);
  if(st==='landing'){location.replace('/inicio');return}
  if(st==='nolocal'){
    document.title='Local no encontrado';$('#placa').className='placa sinlogo';
    $('#nombre').textContent='No encontramos este local';$('#desc').textContent='Revisá la dirección o escribile al local.';
    return;
  }
  if(st==='error'){
    $('#nombre').textContent='Ups';$('#menu').innerHTML='<div class="banner">No pudimos cargar el menú. <button class="btn sm" id="reint">Reintentar</button></div>';
    $('#reint').onclick=function(){location.reload()};return;
  }
  S.cart=loadCart();recordarCliente();
  pintarTienda();
  setInterval(refrescar,60000);
  document.addEventListener('visibilitychange',refrescar);
  var q=new URLSearchParams(location.search),ped=q.get('pedido');
  if(ped&&apiMode()&&/^[a-f0-9]{16}$/.test(ped)){
    try{history.replaceState(null,'',location.pathname+(LOCAL?'?local='+encodeURIComponent(LOCAL):''))}catch(e){}
    store.set('track',JSON.stringify({id:ped,numero:0}));
    abrirSeguimiento(ped,0,true);
  }else revisarPedidoGuardado();
})();
