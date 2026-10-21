/* Minuta · código del panel del local. Se descarga solo en /admin: los clientes de la tienda no lo necesitan. */

/* =====================================================================
   PANEL DEL LOCAL
   ===================================================================== */
var A={tok:'',draft:null,cuenta:null,dirty:false,orders:[],seen:null,fresh:{},tab:'pedidos',ctx:null,timer:null,alarmT:null,storage:true,estado:'activo',venceEl:null,filtro:'activos',fm:'todos',col:0,q:'',mq:'',mf:'todos',sonido:true,alarma:true,avOpen:false,ver:null,cli:{},edit:-1};
var uid=function(p){return p+Math.random().toString(36).slice(2,8)};
var MI_WA_URL=function(t){return 'https://wa.me/'+MINUTA_WA+(t?'?text='+encodeURIComponent(t):'')};
function aFetch(path,opt){
  opt=opt||{};opt.headers=Object.assign({authorization:'Bearer '+A.tok},opt.headers||{});
  return fetch(apiUrl(path),opt).then(function(r){if(r.status===401&&A.tok&&!A.loggingIn)aExpire();return r});
}
function aExpire(){A.tok='';store.del('tok');clearInterval(A.timer);clearInterval(A.alarmT);aShowLogin('Tu sesión venció. Entrá de nuevo.')}
function aShowLogin(m){$('#aPill').hidden=true;$('#aApp').hidden=true;$('#aSave').hidden=true;$('#aSalir').hidden=true;$('#aVer').hidden=true;$('#aLogin').hidden=false;aErr(m||'')}
function aErr(m){$('#aErr').textContent=m||''}
function aMsg(m){$('#aMsg').textContent=m||''}
function markDirty(){A.dirty=true;$('#aGuardar').disabled=false;$('#aSave').classList.add('dirty');aMsg('Hay cambios sin guardar.')}
window.addEventListener('beforeunload',function(e){if(A.dirty){e.preventDefault();e.returnValue=''}});
document.addEventListener('click',function(){
  if(!isAdminRoute)return;
  try{A.ctx=A.ctx||new (window.AudioContext||window.webkitAudioContext)();if(A.ctx.state==='suspended')A.ctx.resume()}catch(e){}
});

async function aLogin(){
  var email=$('#aEmail').value.trim(),pw=$('#aPass').value;
  if(!email||!pw){aErr('Escribí tu email y tu contraseña.');return}
  try{A.ctx=A.ctx||new (window.AudioContext||window.webkitAudioContext)()}catch(e){}
  aErr('');A.loggingIn=true;$('#aEntrar').disabled=true;$('#aEntrar').textContent='Entrando…';
  var r,j;
  try{r=await fetch(apiUrl('/api/login'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:email,password:pw})});j=await r.json().catch(function(){return null})}
  catch(e){j=null;r={ok:false}}
  A.loggingIn=false;$('#aEntrar').disabled=false;$('#aEntrar').textContent='Entrar';
  if(!r.ok||!j||!j.token){aErr((j&&j.mensaje)||'No pudimos conectar con el servidor.');return}
  A.tok=j.token;store.set('tok',j.token);$('#aPass').value='';
  await aEnter();
}
async function aEnter(){
  var r,j;
  A.loggingIn=true;
  try{r=await aFetch('/api/orders?todo=1');j=await r.json().catch(function(){return null})}catch(e){A.loggingIn=false;aErr('No pudimos conectar con el servidor.');return}
  A.loggingIn=false;
  if(r.status===401){A.tok='';store.del('tok');aShowLogin('');return}
  if(!r.ok||!j||!Array.isArray(j.orders)){aShowLogin((j&&j.mensaje)||'El panel solo funciona con el sitio publicado, porque necesita el servidor.');return}
  A.orders=j.orders;A.estado=j.estado;A.venceEl=j.venceEl;A.ultFull=Date.now();A.orev=j.rev;
  A.seen=new Set(j.orders.map(function(o){return o.id}));
  await cargarConfig(true);
  A.storage=!!S.storage;
  A.draft=clone(S.cfg);A.base=clone(S.cfg);A.dirty=false;
  A.sonido=store.get('sonido')!=='0';A.alarma=store.get('alarma')!=='0';
  $('#aLogin').hidden=true;$('#aApp').hidden=false;$('#aSalir').hidden=false;$('#aVer').hidden=false;$('#aVer').href=storeUrl();
  $('#aTitulo').textContent=S.cfg.nombre;
  aErr('');
  aShow('pedidos');
  clearInterval(A.timer);A.timer=setInterval(aPoll,10000);
  clearInterval(A.alarmT);A.alarmT=setInterval(alarma,20000);
  /* Al volver a la pestaña (o prender la tablet), trae todo el día de nuevo. */
  if(!A.visEsc){A.visEsc=true;document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&A.tok){A.ultFull=0;aPoll()}})}
}
$('#aEntrar').addEventListener('click',aLogin);
$('#aPass').addEventListener('keydown',function(e){if(e.key==='Enter')aLogin()});
$('#aSalir').addEventListener('click',function(){
  var salir=function(){A.dirty=false;store.del('tok');location.reload()};
  if(A.dirty)confirmar('Tenés cambios sin guardar. Si salís ahora se pierden.',salir,'Salir igual');else salir()});
/* Confirmación propia (no el cuadro del navegador): texto claro, botón de acción y cancelar. */
function confirmar(m,ok,txt){
  var d=$('#dConf');$('#cfMsg').textContent=m;var b=$('#cfOk');b.textContent=txt||'Borrar';
  b.onclick=function(){d.close();ok()};d.showModal();$('#cfNo').focus()}

function aShow(tab){
  A.tab=tab;
  ['pedidos','menu','local','stats','cuenta'].forEach(function(t){$('#t-'+t).hidden=t!==tab});
  $$('#aTabs button').forEach(function(b){b.setAttribute('aria-selected',b.getAttribute('data-tab')===tab)});
  $('#aSave').hidden=tab==='pedidos'||tab==='cuenta'||tab==='stats';
  if(tab==='pedidos')renderOrders();else if(tab==='cuenta')renderCuenta();else if(tab==='stats')renderStats();else if(tab==='menu')renderMenuAdm();else renderLocal();
  window.scrollTo(0,0);
}
$('#aPill').addEventListener('click',function(){aShow('pedidos')});
$('#aTabs').addEventListener('click',function(e){var b=e.target.closest('button[data-tab]');if(b)aShow(b.getAttribute('data-tab'))});

/* ----- Pedidos ----- */
function hora(iso){
  var d=new Date(iso),o={timeZone:TZ};
  var t=d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:TZ});
  var hoy=new Date().toLocaleDateString('es-AR',o)===d.toLocaleDateString('es-AR',o);
  return hoy?t:d.toLocaleDateString('es-AR',{day:'numeric',month:'numeric',timeZone:TZ})+' '+t;
}
function hhmmDe(iso){return new Date(iso).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:TZ})}
var ESTADO_TXT={nuevo:'Nuevo',preparando:'En preparación',listo:'Listo',en_camino:'En camino',entregado:'Entregado',cancelado:'Rechazado'};
var MODO_TXT={retiro:'Retiro',delivery:'Delivery'};
var MOTIVOS=['Nos quedamos sin algún producto','No llegamos a esa zona','Estamos por cerrar','La cocina está muy demorada','No pudimos contactarte'];
/* Pedidos viejos con "takeaway": son retiros. */
function modoDe(o){return o.entrega.modo==='delivery'?'delivery':'retiro'}
function modoTxt(o){return MODO_TXT[modoDe(o)]}
function itNom(i){return i.variante?i.nom+' ('+i.variante+')':i.nom}
function numPed(o){return '#'+String(o.numero).padStart(4,'0')}
function siguiente(o){
  var d=modoDe(o)==='delivery';
  return {nuevo:[['preparando','Aceptar y preparar']],preparando:[['listo',d?'Listo para salir':'Listo para retirar']],listo:d?[['en_camino','Salió en camino']]:[['entregado','Ya lo retiró']],en_camino:[['entregado','Entregado']]}[o.estado]||[];
}
function numDe(s){var n=parseInt(String(s||'').replace(/[^\d]/g,''),10);return isNaN(n)?0:n}
function vuelto(o){if(o.pago.metodo!=='efectivo')return null;var n=numDe(o.pago.cambio);return n&&n>=o.total?n-o.total:null}
function cambioTxt(o){var n=numDe(o.pago.cambio);return n?money(n):'$'+o.pago.cambio}
function pagoHtml(o){
  if(o.pago.metodo==='efectivo'){var v=vuelto(o);return '<p class="pg"><span class="badge line">Efectivo</span>'+(o.pago.cambio?'<span>paga con '+esc(cambioTxt(o))+(v?' · <b>vuelto '+money(v)+'</b>':v===0?' · justo':'')+'</span>':'<span class="mute">sin cambio indicado</span>')+'</p>';}
  return '<p class="pg"><span class="badge '+(o.pago.pagado?'ok':'warn')+'">'+(o.pago.pagado?'Transferencia recibida':'Transferencia pendiente')+'</span></p>';
}
function waNum(tel){
  var d=String(tel).replace(/\D/g,'').replace(/^00/,'');
  if(d.indexOf('549')===0)return d;
  if(d.indexOf('54')===0)d=d.slice(2);
  d=d.replace(/^0/,'');
  if(d.length>10){for(var i=2;i<=4;i++){if(d.substr(i,2)==='15'&&d.length-2===10){d=d.slice(0,i)+d.slice(i+2);break}}}
  return d.length===10?'549'+d:d;
}
function trackUrl(id){return location.origin+'/?pedido='+id+(LOCAL?'&local='+encodeURIComponent(LOCAL):'')}
function storeUrl(){return location.origin+'/'+(LOCAL?'?local='+encodeURIComponent(LOCAL):'')}
function waCliente(o,texto){return 'https://wa.me/'+waNum(o.cliente.tel)+'?text='+encodeURIComponent(texto)}
function entregaAdm(o){
  if(modoDe(o)==='delivery')return 'Delivery a '+o.entrega.dir+' ('+o.entrega.zona+')';
  return 'Retiro en el local · '+(o.entrega.hora?'pasa a las '+o.entrega.hora:'lo antes posible');
}
function msgAlias(o){
  var c=S.cfg;
  return '¡Hola '+o.cliente.nombre+'! Recibimos tu pedido '+'#'+o.numero+' en '+c.nombre+'.\nTotal: '+money(o.total)+'.\n\n'+
  'Para pagar por transferencia:\n*Alias: '+c.alias+'*\n\nCuando transfieras, mandanos el comprobante por este chat y lo preparamos.\n\nSeguí tu pedido acá: '+trackUrl(o.id);
}
function msgEfectivo(o){
  var m=modoDe(o),c=S.cfg,d=c.demora||{},t=m==='delivery'?d.delivery:d.retiro;
  return '¡Hola '+o.cliente.nombre+'! Recibimos tu pedido #'+o.numero+' en '+c.nombre+'.\nTotal: '+money(o.total)+'.\n\n'+
  'Pagás en efectivo '+(m==='delivery'?'cuando te lo llevamos':'cuando lo retirás')+(o.pago.cambio?' (abonás con $'+o.pago.cambio+')':'')+'.\n'+
  (m==='retiro'&&o.entrega.hora?'Te esperamos a las '+o.entrega.hora+'.\n':t?(m==='delivery'?'Llega en ':'Está listo en ')+t+' min aprox.\n':'')+
  (m!=='delivery'&&c.direccion?'Estamos en '+c.direccion+'.\n':'')+
  '\nSeguí tu pedido acá: '+trackUrl(o.id);
}
function aplicar(t,o){
  var v={nombre:o.cliente.nombre,numero:o.numero,local:S.cfg.nombre,direccion:o.entrega&&o.entrega.dir||S.cfg.direccion||'',total:money(o.total),seguimiento:trackUrl(o.id)};
  return t.replace(/\{(\w+)\}/g,function(m,k){return v[k]==null?m:v[k]});
}
function msgListo(o){return S.cfg.msgListo?aplicar(S.cfg.msgListo,o):msgListoDef(o)}
function msgListoDef(o){return '¡Hola '+o.cliente.nombre+'! Tu pedido #'+o.numero+' ya está listo'+(modoDe(o)==='delivery'?' y sale en un momento.':' para retirar'+(S.cfg.direccion?' en '+S.cfg.direccion:'')+'.')}
function msgCamino(o){return S.cfg.msgCamino?aplicar(S.cfg.msgCamino,o):msgCaminoDef(o)}
function msgCaminoDef(o){
  var v=vuelto(o);
  return '¡Hola '+o.cliente.nombre+'! Tu pedido #'+o.numero+' ya salió y va en camino a '+o.entrega.dir+'.'+
  (o.pago.metodo==='efectivo'?'\nTotal a pagar: '+money(o.total)+(v?' (te llevamos '+money(v)+' de vuelto)':'')+'.':'');
}
function msgRechazo(o,motivo){return 'Hola '+o.cliente.nombre+'. Lamentablemente no podemos tomar tu pedido #'+o.numero+(motivo?': '+motivo.charAt(0).toLowerCase()+motivo.slice(1):'')+'. ¡Disculpá las molestias!'}

/* Tiempos: cuánto lleva cada pedido y qué tan apurado está. */
function minDesde(iso){return Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/60000))}
function tEstado(o){var h=o.historial||[];for(var i=h.length-1;i>=0;i--)if(h[i].e===o.estado)return h[i].t;return o.creado}
function minHasta(hm){var n=nowAR(),p=String(hm).split(':'),m=(+p[0])*60+(+p[1])-Math.floor(n.h*60);if(m<-720)m+=1440;if(m>720)m-=1440;return m}
function objetivo(o){var dm=S.cfg.demora||{};return modoDe(o)==='delivery'?(dm.delivery||45):(dm.retiro||25)}
function urgencia(o){
  if(o.estado==='nuevo'){var w=minDesde(o.creado);return {txt:w<1?'Recién entró':'Espera hace '+w+' min',cls:w>=5?'bad':w>=2?'warn':'ok'}}
  if(o.estado==='preparando'&&modoDe(o)==='retiro'&&o.entrega.hora){var f=minHasta(o.entrega.hora);return {txt:f>0?'Pasa en '+f+' min':f===0?'Pasa ahora':'Pasó hace '+(-f)+' min',cls:f<=5?'bad':f<=15?'warn':'ok'}}
  if(o.estado==='listo'){var l=minDesde(tEstado(o));return {txt:'Listo hace '+l+' min',cls:l>=15?'bad':l>=8?'warn':'ok'}}
  if(o.estado==='en_camino'){var c=minDesde(tEstado(o));return {txt:'En viaje '+c+' min',cls:c>=40?'bad':c>=25?'warn':'ok'}}
  var t=minDesde(o.creado),ob=objetivo(o);
  return {txt:t+' de '+ob+' min',cls:t>ob?'bad':t>ob*0.75?'warn':'ok'};
}
/* Lo más urgente arriba: la hora de retiro elegida, o la hora en que entró más la demora. */
function vence(o){
  if(modoDe(o)==='retiro'&&o.entrega.hora)return Date.now()+minHasta(o.entrega.hora)*60000;
  return new Date(o.creado).getTime()+objetivo(o)*60000;
}
function clientesFrecuentes(){var m={};A.orders.forEach(function(o){if(o.estado!=='cancelado'){var k=waNum(o.cliente.tel);m[k]=(m[k]||0)+1}});return m}
function cliBadge(o){var n=(A.cli||{})[waNum(o.cliente.tel)]||0;return n>1?'<span class="badge frec" title="Pedidos recientes de este cliente">'+ico('star')+n+' pedidos</span>':'<span class="badge">Cliente nuevo</span>'}
function waAccion(o,cls){
  var fin=FINAL[o.estado],c=cls||'btn sm wa';
  if(fin)return '';
  if(o.pago.metodo==='transferencia'&&!o.pago.pagado&&(o.estado==='nuevo'||o.estado==='preparando'))
    return S.cfg.alias?'<a class="'+c+'" target="_blank" rel="noopener" href="'+esc(waCliente(o,msgAlias(o)))+'">'+ico('wa')+'Mandar alias</a>':'<button class="btn sm ghost" data-go="local">Cargá tu alias</button>';
  if(o.estado==='nuevo')return '<a class="'+c+'" target="_blank" rel="noopener" href="'+esc(waCliente(o,msgEfectivo(o)))+'">'+ico('wa')+'Confirmar</a>';
  if(o.estado==='listo')return '<a class="'+c+'" target="_blank" rel="noopener" href="'+esc(waCliente(o,msgListo(o)))+'">'+ico('wa')+'Avisar que está listo</a>';
  if(o.estado==='en_camino')return '<a class="'+c+'" target="_blank" rel="noopener" href="'+esc(waCliente(o,msgCamino(o)))+'">'+ico('wa')+'Avisar que va</a>';
  return '';
}
function entregaHtml(o){
  if(modoDe(o)==='delivery')return '<p class="ent">'+ico('envio')+'<span><b>'+esc(o.entrega.dir)+'</b> · '+esc(o.entrega.zona)+' · <a href="'+esc(mapsUrl(o.entrega.dir+', '+o.entrega.zona))+'" target="_blank" rel="noopener">Ver mapa</a></span></p>';
  return '<p class="ent">'+ico('retiro')+'<span>'+(o.entrega.hora?'Retira a las <b>'+esc(o.entrega.hora)+' hs</b>':'Retira <b>lo antes posible</b>')+'</span></p>';
}
function itemsHtml(o,precios){
  return '<ul class="its">'+o.items.map(function(i){
    return '<li><b class="qq">'+i.qty+'×</b><span>'+esc(i.nom)+(i.variante?' <span class="vr">· '+esc(i.variante)+'</span>':'')+(i.extras.length?'<small>+ '+esc(i.extras.join(', '))+'</small>':'')+(i.nota?'<em class="nt">“'+esc(i.nota)+'”</em>':'')+'</span>'+(precios?'<span class="mono">'+money(i.unit*i.qty)+'</span>':'')+'</li>';
  }).join('')+'</ul>';
}
function ticketHtml(o,isNew){
  var sig=siguiente(o),fin=FINAL[o.estado],u=fin?null:urgencia(o),md=modoDe(o);
  var tel=String(o.cliente.tel).replace(/[^\d+]/g,''),cant=o.items.reduce(function(s,i){return s+i.qty},0);
  var st=o.estado==='nuevo'?'warn':o.estado==='listo'||o.estado==='entregado'?'ok':o.estado==='cancelado'?'bad':'';
  var acts='';
  sig.forEach(function(s){acts+='<button class="btn go'+(o.estado==='nuevo'?'':' dark')+'" data-o="'+esc(o.id)+'" data-e="'+s[0]+'">'+s[1]+'</button>'});
  var sec=waAccion(o);
  if(!fin&&o.pago.metodo==='transferencia'&&!o.pago.pagado)sec+='<button class="btn sm ghost" data-o="'+esc(o.id)+'" data-pagado="1">Ya transfirió</button>';
  sec+='<button class="btn sm ghost ic" data-print="'+esc(o.id)+'" aria-label="Imprimir comanda" title="Imprimir comanda">'+ico('print')+'</button>';
  if(!fin)sec+='<button class="btn sm danger ic" data-rech="'+esc(o.id)+'" aria-label="Rechazar pedido" title="Rechazar">'+ico('x')+'</button>';
  return '<article class="tk m-'+md+(isNew?' new':'')+(u&&u.cls==='bad'?' late':'')+'" data-id="'+esc(o.id)+'" title="Tocá para ver todo el pedido">'+
  '<header class="th"><span class="num">'+numPed(o)+'</span><span class="badge line">'+ico(md==='delivery'?'envio':'retiro')+esc(modoTxt(o))+'</span>'+
  (fin?'<span class="badge '+st+'">'+ESTADO_TXT[o.estado]+'</span>':'<span class="badge t-'+u.cls+'">'+ico('reloj')+esc(u.txt)+'</span>')+
  '<span class="hr" title="Hora en que entró">'+esc(hora(o.creado))+'</span></header>'+
  '<div class="tk-who"><p class="cli"><b>'+esc(o.cliente.nombre)+'</b> '+cliBadge(o)+'<a class="tel" href="tel:'+esc(tel)+'">'+esc(o.cliente.tel)+'</a></p>'+entregaHtml(o)+'</div>'+
  '<div class="tk-items">'+itemsHtml(o,false)+
  (o.nota?'<p class="nota">'+ico('comanda')+esc(o.nota)+'</p>':'')+
  (o.notaLocal?'<p class="nint">Nota interna: '+esc(o.notaLocal)+'</p>':'')+
  (o.estado==='cancelado'&&o.motivo?'<p class="mute" style="font-size:13px">Motivo: '+esc(o.motivo)+'</p>':'')+'</div>'+
  '<div class="tk-pay"><div class="tt"><span>'+cant+' '+(cant===1?'producto':'productos')+(o.envio?'<small style="display:block;font-size:12.5px">incluye envío '+money(o.envio)+'</small>':'')+'</span><span>'+money(o.total)+'</span></div>'+pagoHtml(o)+'</div>'+
  '<div class="tk-acts">'+(acts?'<div class="acts main">'+acts+'</div>':'')+'<div class="acts">'+sec+'</div></div></article>';
}
function barraEstado(){
  var c=S.cfg,pausa=c.pausado,abierto=isOpen(c),h=c.horario;
  var tit=pausa?'Pedidos en pausa':abierto?'Estás recibiendo pedidos':'Fuera de horario';
  var sb=pausa?'Tu tienda figura cerrada hasta que la abras.':abierto?'Atendés hasta las '+pad((cierraA(h)||h.hasta)%24)+'.':'Abrís a las '+aperturasTxt(h).replace(' hs','')+' ('+diasTxt(h.dias)+'). Cambialo en “Mi local”.';
  var off=S.cfg.menu.filter(function(p){return p.off}).length,hoyN=statsHoy();
  return '<div class="stat '+(!pausa&&abierto?'on':'')+'"><div><b><span class="dot"></span>'+tit+'</b><small>'+esc(sb)+'</small><span class="hoy">Hoy: '+hoyN.n+' '+(hoyN.n===1?'pedido':'pedidos')+' · '+money(hoyN.tot)+'</span></div>'+
  '<div class="acts" style="margin:0"><button class="btn sm ghost" id="aStock">'+ico('plato')+'Stock'+(off?' · '+off+' agotado'+(off>1?'s':''):'')+'</button><button class="btn'+(pausa?' ok':' ghost')+'" id="aPausa">'+(pausa?'Abrir pedidos':'Pausar pedidos')+'</button></div></div>';
}
function avisosHtml(){
  var np=('Notification' in window)?Notification.permission:'na';
  return '<div class="tools"><details class="avisos" id="oAvisos"'+(A.avOpen?' open':'')+'><summary>'+ico('bell')+'<span>Avisos: <b>'+(A.sonido?(A.alarma?'suena hasta que aceptás el pedido':'suena una vez'):'sin sonido')+'</b></span></summary><div class="checks" style="flex-direction:column;gap:10px;margin:10px 0 2px">'+
  '<label class="chk"><input type="checkbox" id="avSon"'+(A.sonido?' checked':'')+'> Sonar cuando entra un pedido</label>'+
  '<label class="chk"><input type="checkbox" id="avAla"'+(A.alarma?' checked':'')+(A.sonido?'':' disabled')+'> Repetir el sonido cada 20 segundos hasta que lo aceptes</label>'+
  (np==='na'?'':np==='granted'?'<span class="mute" style="font-size:13px">✓ Avisos del navegador activados: te llegan aunque estés en otra pestaña.</span>':np==='denied'?'<span class="mute" style="font-size:13px">El navegador bloqueó los avisos. Habilitalos desde el candado de la barra de direcciones.</span>':'<button class="btn sm ghost" id="avNot" style="align-self:flex-start">'+ico('bell')+'Activar avisos aunque esté en otra pestaña</button>')+
  '<button class="btn sm ghost" id="avProbar" style="align-self:flex-start">Probar sonido</button></div></details>'+
  '<a class="btn ghost" href="'+esc(storeUrl())+'" target="_blank" rel="noopener">Ver mi tienda</a><button class="btn ghost" id="aCopiar">Copiar link para clientes</button></div>';
}
function checklist(){
  var c=S.cfg,okWa=String(c.whatsapp||'').replace(/\D/g,'').length>=10,okMenu=store.get('menuok')==='1';
  var pasos=[
    [okWa,'Cargá el WhatsApp de tu local','local'],
    [okMenu,'Armá tu menú, tus precios y tus fotos','menu'],
    [!!c.direccion,'Poné la dirección del local','local'],
    [!!c.alias,'Cargá tu alias para cobrar transferencias','local'],
    [!!(c.logo||c.banner),'Subí tu logo o tu banner','local'],
    [!c.pausado,'Abrí los pedidos','pedidos']
  ];
  if(pasos.every(function(p){return p[0]}))return '';
  var n=pasos.filter(function(p){return p[0]}).length;
  var h='<div class="guide"><div class="gh"><b>Dejá tu local listo para vender</b><span>'+n+' de '+pasos.length+'</span></div><div class="prog"><i style="width:'+Math.round(n/pasos.length*100)+'%"></i></div><ol>';
  var lugar={local:'Ir a Mi local',menu:'Ir a Menú'};
  pasos.forEach(function(p){
    h+='<li class="'+(p[0]?'ok':'')+'"><span class="ck">'+(p[0]?'✓':'')+'</span><span>'+esc(p[1])+'</span>'+(!p[0]&&lugar[p[2]]?'<button class="btn sm ghost" data-go="'+p[2]+'">'+lugar[p[2]]+'</button>':'')+'</li>';
  });
  h+='</ol>'+(!okMenu?'<button class="lk" id="aMenuOk">Ya revisé mi menú</button>':'')+'</div>';
  return h;
}
function minEntre(a,b){return Math.max(0,Math.round((new Date(b)-new Date(a))/60000))}
function statsHoy(){
  var hoy=hoyAR(),deHoy=A.orders.filter(function(o){return hoyAR(new Date(o.creado))===hoy});
  var os=deHoy.filter(function(o){return o.estado!=='cancelado'});
  var tot=os.reduce(function(s,o){return s+o.total},0),cnt={},ef=0,tr=0,trp=0,env=0,preps=[];
  os.forEach(function(o){
    o.items.forEach(function(i){cnt[itNom(i)]=(cnt[itNom(i)]||0)+i.qty});
    if(o.pago.metodo==='efectivo')ef+=o.total;else{tr+=o.total;if(!o.pago.pagado)trp+=o.total}
    env+=o.envio||0;
    var l=(o.historial||[]).filter(function(h){return h.e==='listo'})[0];if(l)preps.push(minEntre(o.creado,l.t));
  });
  var top=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a]}).slice(0,3);
  var pend=A.orders.filter(function(o){return o.pago.metodo==='transferencia'&&!o.pago.pagado&&!FINAL[o.estado]}).length;
  var curso=A.orders.filter(function(o){return !FINAL[o.estado]}).length;
  return {n:os.length,tot:tot,prom:os.length?Math.round(tot/os.length):0,top:top.map(function(k){return [k,cnt[k]]}),pend:pend,curso:curso,
    ef:ef,tr:tr,trp:trp,env:env,rech:deHoy.length-os.length,prep:preps.length?Math.round(preps.reduce(function(a,b){return a+b},0)/preps.length):null};
}
function kpisHtml(){
  var st=statsHoy(),h='<div class="kpis">'+
  '<div class="kpi dark"><span>Pedidos hoy</span><b>'+st.n+'</b></div>'+
  '<div class="kpi"><span>Vendido hoy</span><b>'+money(st.tot)+'</b></div>'+
  '<div class="kpi"><span>Ticket promedio</span><b>'+money(st.prom)+'</b></div>'+
  '<div class="kpi"><span>En curso</span><b>'+st.curso+'</b></div>'+
  '<div class="kpi"><span>Cocina (prom.)</span><b>'+(st.prep===null?'—':st.prep+' min')+'</b></div>'+
  '<div class="kpi'+(st.pend?' warn':'')+'"><span>Transf. pendientes</span><b>'+st.pend+'</b></div></div>';
  h+='<div class="caja"><span>Caja de hoy:</span> <b>Efectivo '+money(st.ef)+'</b> · <b>Transferencias '+money(st.tr)+'</b>'+(st.trp?' <span class="mute">(sin confirmar '+money(st.trp)+')</span>':'')+(st.env?' · Envíos '+money(st.env):'')+(st.rech?' · '+st.rech+' rechazado'+(st.rech>1?'s':''):'')+
  ' <button class="lk" id="aCsv">Descargar planilla del día</button></div>';
  if(st.top.length)h+='<div class="top3">Lo más pedido hoy: '+st.top.map(function(t){return '<b>'+esc(t[0])+'</b> ×'+t[1]}).join(' · ')+'</div>';
  return h;
}
/* ---------- Números: ventas y pedidos de la semana o del mes ---------- */
var p2=function(n){return (n<10?'0':'')+n};
var DSEM=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
async function renderStats(){
  var el=$('#t-stats'),per=A.sper||7;
  if(!A.stats||A.stats.dias!==per||Date.now()-(A.statsT||0)>300000){
    el.innerHTML='<p class="note">Calculando…</p>';
    try{var r=await aFetch('/api/orders?stats='+per);if(!r.ok)throw 0;A.stats=await r.json();A.statsT=Date.now()}catch(e){el.innerHTML='<p class="note">No pudimos cargar los números. Probá de nuevo en un rato.</p>';return}
  }
  var s=A.stats,a=s.actual,b=s.anterior;
  var delta=function(x,y){if(!y)return x?'<div class="st-d eq">sin período anterior</div>':'';var p=Math.round((x-y)/y*100);return '<div class="st-d '+(p>0?'up':p<0?'dn':'eq')+'">'+(p>0?'▲ +':p<0?'▼ ':'= ')+p+'% vs. anterior</div>'};
  var h='<div class="sh" style="margin-top:22px"><h2>Números</h2><p>Cómo viene vendiendo tu local, comparado con el período anterior.</p></div><div class="st-per"><button data-sp="7" aria-pressed="'+(per===7)+'">Últimos 7 días</button><button data-sp="30" aria-pressed="'+(per===30)+'">Últimos 30 días</button></div>';
  if(!a.pedidos&&!a.cancelados&&!b.pedidos){
    el.innerHTML=h+'<p class="note">Todavía no hay pedidos en este período. Los números se arman con los pedidos que entren desde ahora.</p>';return}
  h+='<div class="kpis">'+
   '<div class="kpi dark"><span>Vendido</span><b>'+money(a.ventas)+'</b>'+delta(a.ventas,b.ventas)+'</div>'+
   '<div class="kpi"><span>Pedidos</span><b>'+a.pedidos+'</b>'+delta(a.pedidos,b.pedidos)+'</div>'+
   '<div class="kpi"><span>Ticket promedio</span><b>'+money(a.ticket)+'</b>'+delta(a.ticket,b.ticket)+'</div>'+
   '<div class="kpi'+(a.cancelados?' warn':'')+'"><span>Rechazados</span><b>'+a.cancelados+'</b></div></div>';
  /* Ventas por día */
  var mx=Math.max.apply(null,a.porDia.map(function(d){return d.v}))||1,best=a.porDia.reduce(function(m,d){return d.v>m.v?d:m},a.porDia[0]);
  h+='<div class="st-box"><h4 role="heading" aria-level="3">Ventas por día</h4><div class="bars">'+a.porDia.map(function(d){
    return '<i class="'+(d.v&&d===best?'pk':d.v?'on':'')+'" style="height:'+Math.max(2,Math.round(d.v/mx*100))+'%" title="'+esc(d.d.slice(8)+'/'+d.d.slice(5,7)+': '+money(d.v)+' · '+d.n+' pedidos')+'"></i>'}).join('')+'</div>'+
   '<div class="bl">'+a.porDia.map(function(d,i){var t=per===7?DSEM[new Date(d.d+'T12:00:00').getDay()]:(i%5===0?d.d.slice(8):'');return '<span>'+t+'</span>'}).join('')+'</div>'+
   (best&&best.v?'<p class="note" style="margin:10px 0 0">Mejor día: <b>'+best.d.slice(8)+'/'+best.d.slice(5,7)+'</b> con '+money(best.v)+' ('+best.n+' pedidos).</p>':'')+'</div>';
  /* Horas y días */
  var hm=Math.max.apply(null,a.porHora)||1,hp=a.porHora.indexOf(hm);
  var sm=Math.max.apply(null,a.porSemana)||1,sp=a.porSemana.indexOf(sm),ord=[1,2,3,4,5,6,0];
  h+='<div class="st-two"><div class="st-box"><h4 role="heading" aria-level="3">A qué hora piden</h4><div class="bars">'+a.porHora.map(function(n,i){return '<i class="'+(n&&i===hp?'pk':n?'on':'')+'" style="height:'+Math.max(2,Math.round(n/hm*100))+'%" title="'+p2(i)+' hs: '+n+' pedidos"></i>'}).join('')+'</div>'+
   '<div class="bl">'+a.porHora.map(function(n,i){return '<span>'+(i%6===0?p2(i):'')+'</span>'}).join('')+'</div>'+
   '<p class="note" style="margin:10px 0 0">Hora pico: <b>'+p2(hp)+' a '+p2((hp+1)%24)+' hs</b>.</p></div>'+
   '<div class="st-box"><h4 role="heading" aria-level="3">Qué días piden más</h4><div class="bars">'+ord.map(function(d){var n=a.porSemana[d];return '<i class="'+(n&&d===sp?'pk':n?'on':'')+'" style="height:'+Math.max(2,Math.round(n/sm*100))+'%" title="'+DSEM[d]+': '+n+' pedidos"></i>'}).join('')+'</div>'+
   '<div class="bl">'+ord.map(function(d){return '<span>'+DSEM[d]+'</span>'}).join('')+'</div>'+
   '<p class="note" style="margin:10px 0 0">Día más fuerte: <b>'+DIAS[sp]+'</b>.</p></div></div>';
  /* Más pedidos y forma de pedir */
  var tm=a.top.length?a.top[0].qty:1;
  h+='<div class="st-two"><div class="st-box"><h4 role="heading" aria-level="3">Lo más pedido</h4>'+(a.top.length?a.top.map(function(t){return '<div class="rk"><span><b>'+esc(t.nom)+'</b></span><span class="mono">×'+t.qty+' · '+money(t.ventas)+'</span><div class="bar"><i style="width:'+Math.round(t.qty/tm*100)+'%"></i></div></div>'}).join(''):'<p class="note">Sin datos.</p>')+'</div>';
  var tp=(a.retiro+a.delivery)||1,tg=(a.efectivo+a.transferencia)||1,pc=function(x,t){return Math.round(x/t*100)+'%'};
  h+='<div class="st-box"><h4 role="heading" aria-level="3">Cómo piden</h4>'+
   '<div class="rk"><span>Retiro en el local</span><span class="mono">'+a.retiro+' · '+pc(a.retiro,tp)+'</span><div class="bar"><i style="width:'+pc(a.retiro,tp)+'"></i></div></div>'+
   '<div class="rk"><span>Delivery</span><span class="mono">'+a.delivery+' · '+pc(a.delivery,tp)+'</span><div class="bar"><i style="width:'+pc(a.delivery,tp)+'"></i></div></div>'+
   '<div class="rk" style="margin-top:14px"><span>Pagan en efectivo</span><span class="mono">'+a.efectivo+' · '+pc(a.efectivo,tg)+'</span><div class="bar"><i style="width:'+pc(a.efectivo,tg)+'"></i></div></div>'+
   '<div class="rk"><span>Pagan por transferencia</span><span class="mono">'+a.transferencia+' · '+pc(a.transferencia,tg)+'</span><div class="bar"><i style="width:'+pc(a.transferencia,tg)+'"></i></div></div>'+
   (a.envios?'<p class="note" style="margin:10px 0 0">Cobrado en envíos: <b>'+money(a.envios)+'</b> (ya está incluido en lo vendido).</p>':'')+'</div></div>';
  h+='<p class="note">Los rechazados no cuentan como venta. Se actualiza cada 5 minutos.</p>';
  el.innerHTML=h;
}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-sp]');if(!b)return;A.sper=+b.getAttribute('data-sp');A.stats=null;renderStats()});

function filtrar(list){
  var q=A.q.trim().toLowerCase().replace(/^#0*/,'');
  if(A.fm!=='todos')list=list.filter(function(o){return modoDe(o)===A.fm});
  if(!q)return list;
  return list.filter(function(o){return String(o.numero).indexOf(q)>-1||o.cliente.nombre.toLowerCase().indexOf(q)>-1||String(o.cliente.tel).replace(/\D/g,'').indexOf(q.replace(/\D/g,'')||'§')>-1||(o.entrega.dir||'').toLowerCase().indexOf(q)>-1});
}
function renderOrders(){
  var h='';
  if(A.estado==='vencido')h+='<div class="banner">Tu mensualidad está vencida y el local no recibe pedidos nuevos. <a target="_blank" rel="noopener" href="'+esc(MI_WA_URL('Hola! Quiero regularizar la mensualidad de '+S.cfg.nombre+'.'))+'">Escribinos para regularizarla</a>.</div>';
  if(A.estado==='suspendido')h+='<div class="banner">Tu local está suspendido y no recibe pedidos nuevos. <a target="_blank" rel="noopener" href="'+esc(MI_WA_URL('Hola! Quiero reactivar '+S.cfg.nombre+'.'))+'">Escribinos para reactivarlo</a>.</div>';
  if(!A.storage)h+='<div class="banner">Falta conectar la base de datos (Upstash Redis) en Vercel. Sin eso no se guardan pedidos ni cambios.</div>';
  h+='<div id="oStat">'+barraEstado()+'</div>'+avisosHtml()+checklist();
  var md=modosDe(S.cfg);
  h+='<div class="sh"><h2>Pedidos</h2><p>Cada pedido avanza con su botón grande, de izquierda a derecha. Tocá la comanda para ver todos los datos del cliente.</p></div>';
  h+='<div class="toolbar"><input type="search" id="oBuscar" placeholder="Buscar por número, nombre, teléfono o dirección" value="'+esc(A.q)+'" aria-label="Buscar pedidos"><div class="chips" id="oFiltro">'+
    [['activos','En curso'],['terminados','Terminados']].map(function(f){return '<button aria-pressed="'+(A.filtro===f[0])+'" data-f="'+f[0]+'">'+f[1]+'</button>'}).join('')+'</div>'+
    (md.delivery||A.orders.some(function(o){return modoDe(o)==='delivery'})?'<div class="chips" id="oModo" role="group" aria-label="Filtrar por entrega"><span class="cap mute">Entrega</span>'+[['todos','Todos'],['retiro','Retiro'],['delivery','Delivery']].map(function(f){return '<button aria-pressed="'+(A.fm===f[0])+'" data-fm="'+f[0]+'">'+f[1]+'</button>'}).join('')+'</div>':'')+'</div>';
  h+='<div id="oLista"></div>';
  h+='<h4 class="resu" role="heading" aria-level="3">Resumen de hoy</h4><div id="oKpis">'+kpisHtml()+'</div>';
  $('#t-pedidos').innerHTML=h;
  pintarLista();
}
/* Lo que cambia con cada consulta al servidor, sin tocar lo que el local está usando. */
function refrescarPedidos(){
  var s=$('#oStat');if(s)s.innerHTML=barraEstado();
  var k=$('#oKpis');if(k)k.innerHTML=kpisHtml();
  pintarLista();
}
function columnas(all){
  var cols=[['nuevo','Nuevos'],['preparando','En preparación'],['listo','Listos']];
  if(modosDe(S.cfg).delivery||all.some(function(o){return o.estado==='en_camino'}))cols.push(['en_camino','En camino']);
  return cols;
}
function pintarLista(){
  var el=$('#oLista');
  var nuevos=A.orders.filter(function(o){return o.estado==='nuevo'}).length;
  var c=$('#cntNuevos');c.hidden=!nuevos;c.textContent=nuevos;
  document.title=(nuevos?'('+nuevos+') ':'')+'Panel · '+S.cfg.nombre;
  pintarPill();
  if(!el)return;
  A.cli=clientesFrecuentes();
  var all=filtrar(A.orders),h='';
  if(A.filtro==='activos'){
    var cols=columnas(A.orders);
    if(A.col>=cols.length)A.col=0;
    h='<div class="colnav" id="colnav">'+cols.map(function(cc,i){var n=all.filter(function(o){return o.estado===cc[0]}).length;return '<button data-col="'+i+'" aria-current="'+(i===A.col)+'">'+cc[1]+'<span class="'+(cc[0]==='nuevo'&&n?'hot':'')+'">'+n+'</span></button>'}).join('')+'</div>';
    h+='<div class="board" style="--cols:'+cols.length+'">'+cols.map(function(cc,i){
      var os=all.filter(function(o){return o.estado===cc[0]}).sort(function(a,b){return vence(a)-vence(b)});
      return '<div class="col c-'+cc[0]+(i===A.col?' on':'')+'"><h3><span class="ct"><b>'+cc[1]+'</b><small>'+({nuevo:'Aceptalos para empezar',preparando:'Se están cocinando',listo:'Esperando que salgan o los retiren',en_camino:'En viaje al cliente'}[cc[0]]||'')+'</small></span><span class="n">'+os.length+'</span></h3>'+(os.length?os.map(function(o){return ticketHtml(o,A.fresh[o.id])}).join(''):'<div class="empty">'+(cc[0]==='nuevo'?(A.q||A.fm!=='todos'?'Ningún pedido nuevo con ese filtro.':'Esperando comandas. Suena cuando entra una.'):'Nada por acá.')+'</div>')+'</div>';
    }).join('')+'</div>';
  }else{
    var old=all.filter(function(o){return FINAL[o.estado]}),dias={},orden=[];
    old.forEach(function(o){var d=hoyAR(new Date(o.creado));if(!dias[d]){dias[d]=[];orden.push(d)}dias[d].push(o)});
    var hoy=hoyAR(),ayer=hoyAR(new Date(Date.now()-864e5));
    h=old.length?orden.map(function(d){
      var os=dias[d],tot=os.filter(function(o){return o.estado!=='cancelado'}).reduce(function(s,o){return s+o.total},0);
      return '<h3 class="dia"><span>'+(d===hoy?'Hoy':d===ayer?'Ayer':fechaTxt(d))+'</span><span>'+os.length+' pedidos · '+money(tot)+'</span></h3><div class="fin">'+os.map(function(o){return ticketHtml(o,false)}).join('')+'</div>';
    }).join(''):'<p class="note">Todavía no hay pedidos terminados'+(A.q||A.fm!=='todos'?' con ese filtro':'')+'.</p>';
  }
  el.innerHTML=h;
}
function pintarPill(){
  var p=$('#aPill');if(!p||!S.cfg)return;
  var pausa=S.cfg.pausado,ab=isOpen(S.cfg);
  p.hidden=false;p.className='pill '+(pausa?'off':ab?'on':'cl');
  p.innerHTML='<span class="dot"></span>'+(pausa?'En pausa':ab?'Abierto':'Cerrado');
}
$('#t-pedidos').addEventListener('input',function(e){if(e.target.id==='oBuscar'){A.q=e.target.value;pintarLista()}});
$('#t-pedidos').addEventListener('toggle',function(e){if(e.target.id==='oAvisos')A.avOpen=e.target.open},true);
$('#t-pedidos').addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='avSon'){A.sonido=t.checked;store.set('sonido',A.sonido?'1':'0');if(A.sonido)beep(true);renderOrders()}
  if(t.id==='avAla'){A.alarma=t.checked;store.set('alarma',A.alarma?'1':'0');renderOrders()}
});
function buscarPedido(id){return A.orders.filter(function(x){return x.id===id})[0]}
async function patchOrder(id,body){
  try{
    var r=await aFetch('/api/orders',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({id:id},body))});
    var j=await r.json().catch(function(){return null});
    if(!r.ok||!j||!j.order){toast((j&&j.mensaje)||'No se pudo cambiar.');return null}
    A.orders=A.orders.map(function(o){return o.id===j.order.id?j.order:o});delete A.fresh[j.order.id];
    return j.order;
  }catch(err){toast('No pudimos conectar.');return null}
}
function trasCambio(o){
  if(A.tab==='pedidos')refrescarPedidos();
  if(o&&$('#dOrd').open&&A.ver===o.id)renderDetalle(o.id);
}
/* Cambia el estado y ofrece deshacerlo por si fue un toque equivocado. */
async function cambiarEstado(id,estado,extra){
  var o=buscarPedido(id),prev=o&&o.estado;
  var n=await patchOrder(id,Object.assign({estado:estado},extra||{}));
  if(!n)return null;
  trasCambio(n);
  var acc=[];
  /* Listo para retirar o en camino: un toque para avisarle al cliente por WhatsApp. */
  if(prev!==n.estado&&((n.estado==='listo'&&modoDe(n)==='retiro')||n.estado==='en_camino'))
    acc.push({txt:'Avisar por WhatsApp',fn:function(){window.open(waCliente(n,n.estado==='listo'?msgListo(n):msgCamino(n)),'_blank','noopener')}});
  if(prev&&prev!==n.estado)acc.push({txt:'Deshacer',fn:async function(){var b=await patchOrder(id,{estado:prev});if(b){trasCambio(b);toast('Listo, volvió a “'+ESTADO_TXT[prev]+'”.')}}});
  toast('Pedido '+numPed(n)+': '+ESTADO_TXT[n.estado]+'.',acc.length?acc:null);
  return n;
}
$('#t-pedidos').addEventListener('click',async function(e){
  var b=e.target.closest('button');
  if(!b){
    /* Tocar la comanda (fuera de botones y links) abre el detalle completo. */
    var tk=e.target.closest('.tk[data-id]');
    if(tk&&!e.target.closest('a,summary,input,label'))abrirDetalle(tk.getAttribute('data-id'));
    return;
  }
  if(b.hasAttribute('data-go')){aShow(b.getAttribute('data-go'));return}
  if(b.hasAttribute('data-col')){A.col=+b.getAttribute('data-col');pintarLista();return}
  if(b.hasAttribute('data-f')){A.filtro=b.getAttribute('data-f');$$('#oFiltro button').forEach(function(x){x.setAttribute('aria-pressed',x===b)});pintarLista();return}
  if(b.hasAttribute('data-fm')){A.fm=b.getAttribute('data-fm');$$('#oModo button').forEach(function(x){x.setAttribute('aria-pressed',x===b)});pintarLista();return}
  if(b.id==='aMenuOk'){store.set('menuok','1');renderOrders();return}
  if(b.id==='avProbar'){beep(true);return}
  if(b.id==='avNot'){try{Notification.requestPermission().then(function(){renderOrders()})}catch(err){}return}
  if(b.id==='aCsv'){exportarCSV();return}
  if(b.id==='aStock'){abrirStock();return}
  if(b.hasAttribute('data-print')){imprimir(b.getAttribute('data-print'));return}
  if(b.hasAttribute('data-ver')){abrirDetalle(b.getAttribute('data-ver'));return}
  if(b.hasAttribute('data-rech')){abrirRechazo(b.getAttribute('data-rech'));return}
  if(b.id==='aCopiar'){
    var u=storeUrl();
    try{await navigator.clipboard.writeText(u);toast('Link copiado. Pegalo en tu Instagram o WhatsApp.')}catch(err){b.textContent=u}
    return;
  }
  if(b.id==='aPausa'){
    b.disabled=true;
    var quiere=!S.cfg.pausado;
    var res=await cambioRapido(function(c){c.pausado=quiere});
    if(res.ok)toast(quiere?'Pedidos en pausa.':'Listo, ya estás recibiendo pedidos.');
    else{b.disabled=false;toast(res.msg);if(/WhatsApp/.test(res.msg))aShow('local');return}
    renderOrders();return;
  }
  if(b.hasAttribute('data-o')){
    b.disabled=true;
    var id=b.getAttribute('data-o');
    if(b.hasAttribute('data-e'))await cambiarEstado(id,b.getAttribute('data-e'));
    else if(b.hasAttribute('data-pagado')){var o2=await patchOrder(id,{pagado:true});if(o2){trasCambio(o2);toast('Transferencia de '+numPed(o2)+' marcada como recibida.',{txt:'Deshacer',fn:async function(){var x=await patchOrder(id,{pagado:false});if(x)trasCambio(x)}})}}
    b.disabled=false;
  }
});

/* Detalle completo del pedido */
function renderDetalle(id){
  var o=buscarPedido(id);if(!o){$('#dOrd').close();return}
  A.ver=id;
  var md=modoDe(o),fin=FINAL[o.estado],tel=String(o.cliente.tel).replace(/[^\d+]/g,'');
  $('#oNum').innerHTML=numPed(o)+' <span class="badge '+(o.estado==='nuevo'?'warn':o.estado==='cancelado'?'bad':o.estado==='listo'||o.estado==='entregado'?'ok':'')+'">'+ESTADO_TXT[o.estado]+'</span>';
  var hist=(o.historial||[]).map(function(x,i,arr){return '<li><b>'+esc(ESTADO_TXT[x.e]||x.e)+'</b><span class="mono">'+esc(hora(x.t))+(i?' · +'+minEntre(arr[i-1].t,x.t)+' min':'')+'</span></li>'}).join('');
  var estados=['nuevo','preparando','listo'].concat(md==='delivery'?['en_camino']:[]).concat(['entregado']);
  var sig=siguiente(o);
  var h='';
  if(sig.length)h+='<div class="acts main" style="margin-top:12px">'+sig.map(function(s){return '<button class="btn block go'+(o.estado==='nuevo'?'':' dark')+'" data-de="'+s[0]+'">'+s[1]+'</button>'}).join('')+'</div>';
  h+='<div class="dsec"><h4>Cliente</h4><p class="cli"><b>'+esc(o.cliente.nombre)+'</b> '+cliBadge(o)+'</p><div class="acts"><a class="btn sm ghost" href="tel:'+esc(tel)+'">Llamar · '+esc(o.cliente.tel)+'</a><a class="btn sm wa" target="_blank" rel="noopener" href="'+esc(waCliente(o,'Hola '+o.cliente.nombre+'! Te escribimos de '+S.cfg.nombre+' por tu pedido #'+o.numero+'.'))+'">'+ico('wa')+'Escribirle</a></div></div>';
  h+='<div class="dsec"><h4>Entrega</h4>'+entregaHtml(o)+(fin?'':'<p class="mute" style="font-size:13px;margin:4px 0 0">'+esc(urgencia(o).txt)+' · entró a las '+esc(hhmmDe(o.creado))+'</p>')+'</div>';
  h+='<div class="dsec"><h4>Pedido</h4>'+itemsHtml(o,true)+(o.nota?'<p class="nota">'+ico('comanda')+esc(o.nota)+'</p>':'')+
    '<div class="tot"><span>Subtotal</span><span>'+money(o.subtotal)+'</span></div>'+(o.envio?'<div class="tot"><span>Envío ('+esc(o.entrega.zona)+')</span><span>'+money(o.envio)+'</span></div>':'')+
    '<div class="tot big"><span>Total</span><span>'+money(o.total)+'</span></div>'+
    pagoHtml(o)+(o.pago.metodo==='transferencia'?'<button class="lk" data-dpag="'+(o.pago.pagado?'0':'1')+'">'+(o.pago.pagado?'Marcar como no recibida':'Marcar como recibida')+'</button>':'')+'</div>';
  h+='<div class="dsec"><h4>Nota interna</h4><p class="help" style="margin:0 0 4px">Solo la ven ustedes. Ej: “lo retira el hermano”, “timbre no anda”.</p><textarea aria-label="Nota interna del pedido" id="oNotaL" rows="2" maxlength="200">'+esc(o.notaLocal||'')+'</textarea><div class="acts"><button class="btn sm ghost" id="oNotaG">Guardar nota</button></div></div>';
  h+='<div class="dsec"><h4>Mensajes por WhatsApp</h4><div class="acts">'+
    (o.pago.metodo==='transferencia'&&S.cfg.alias?'<a class="btn sm wa" target="_blank" rel="noopener" href="'+esc(waCliente(o,msgAlias(o)))+'">'+ico('wa')+'Alias</a>':'')+
    '<a class="btn sm wa" target="_blank" rel="noopener" href="'+esc(waCliente(o,msgEfectivo(o)))+'">'+ico('wa')+'Confirmar</a>'+
    '<a class="btn sm wa" target="_blank" rel="noopener" href="'+esc(waCliente(o,msgListo(o)))+'">'+ico('wa')+'Está listo</a>'+
    (md==='delivery'?'<a class="btn sm wa" target="_blank" rel="noopener" href="'+esc(waCliente(o,msgCamino(o)))+'">'+ico('wa')+'Va en camino</a>':'')+
    '</div></div>';
  h+='<div class="dsec"><h4>Historial</h4><ol class="hist">'+hist+'</ol>'+(o.motivo?'<p class="mute">Motivo del rechazo: '+esc(o.motivo)+'</p>':'')+
    '<p class="help" style="margin:10px 0 4px">¿Te equivocaste? Pasalo a otro estado:</p><div class="seg">'+estados.map(function(e){return '<button type="button" data-de="'+e+'" aria-pressed="'+(o.estado===e)+'">'+ESTADO_TXT[e]+'</button>'}).join('')+'</div></div>';
  h+='<div class="acts" style="margin-top:16px"><button class="btn ghost" data-print="'+esc(o.id)+'">'+ico('print')+'Imprimir comanda</button>'+(fin?'':'<button class="btn danger" data-rech="'+esc(o.id)+'">Rechazar pedido</button>')+'</div>';
  $('#oBody').innerHTML=h;
}
function abrirDetalle(id){renderDetalle(id);if(!$('#dOrd').open)$('#dOrd').showModal()}
$('#dOrd').addEventListener('close',function(){A.ver=null});
$('#oBody').addEventListener('click',async function(e){
  var b=e.target.closest('button');if(!b||!A.ver)return;
  var id=A.ver;
  if(b.hasAttribute('data-de')){var o=buscarPedido(id);if(o&&o.estado===b.getAttribute('data-de'))return;b.disabled=true;await cambiarEstado(id,b.getAttribute('data-de'));return}
  if(b.hasAttribute('data-dpag')){var x=await patchOrder(id,{pagado:b.getAttribute('data-dpag')==='1'});if(x){trasCambio(x);toast('Listo.')}return}
  if(b.id==='oNotaG'){b.disabled=true;var y=await patchOrder(id,{notaLocal:$('#oNotaL').value});b.disabled=false;if(y){if(A.tab==='pedidos')refrescarPedidos();toast('Nota guardada.')}return}
  if(b.hasAttribute('data-print')){imprimir(id);return}
  if(b.hasAttribute('data-rech')){abrirRechazo(id);return}
});

/* Rechazo con motivo: el cliente lo ve en el seguimiento. */
var RJ=null;
function abrirRechazo(id){
  var o=buscarPedido(id);if(!o)return;RJ=id;
  $('#rTit').textContent='Rechazar '+numPed(o);
  $('#rBody').innerHTML='<p class="note" style="margin-top:12px">'+esc(o.cliente.nombre)+' · '+money(o.total)+'. ¿Por qué no lo pueden tomar? El cliente lo ve en su pantalla de seguimiento.</p><div class="opts" style="margin-top:10px">'+
    MOTIVOS.map(function(m,i){return '<label class="opt rj"><input type="radio" name="rmot" value="'+esc(m)+'"'+(i===0?' checked':'')+'><span>'+esc(m)+'</span></label>'}).join('')+
    '<label class="opt rj"><input type="radio" name="rmot" value=""><span>Otro motivo…</span></label></div>'+
    '<label class="f" id="rOtroBox" hidden>Contale qué pasó<input id="rOtro" maxlength="120"></label>'+
    '<label class="chk" style="margin-top:14px"><input type="checkbox" id="rWa" checked> Avisarle también por WhatsApp</label>'+
    '<div class="acts" style="margin-top:16px"><button class="btn danger" id="rOk">Rechazar pedido</button><button class="btn ghost" data-close>Volver</button></div>';
  $$('#rBody [data-close]').forEach(function(x){x.onclick=function(){$('#dRech').close()}});
  $('#dRech').showModal();
}
$('#rBody').addEventListener('change',function(){var r=document.querySelector('input[name=rmot]:checked');$('#rOtroBox').hidden=!(r&&r.value==='')});
$('#rBody').addEventListener('click',async function(e){
  if(e.target.id!=='rOk')return;
  var o=buscarPedido(RJ);if(!o)return;
  var r=document.querySelector('input[name=rmot]:checked'),mot=r&&r.value?r.value:$('#rOtro').value.trim();
  /* WhatsApp se abre en el mismo toque para que el navegador no lo bloquee. */
  if($('#rWa').checked)window.open(waCliente(o,msgRechazo(o,mot)),'_blank','noopener');
  e.target.disabled=true;
  var n=await cambiarEstado(RJ,'cancelado',{motivo:mot});
  e.target.disabled=false;
  if(n)$('#dRech').close();
});

/* Stock rápido: se publica al instante, sin tocar “Guardar cambios”. */
async function stockInstant(pid,hay){
  if(!S.cfg.menu.some(function(x){return x.id===pid})){
    var dp=A.draft.menu.filter(function(x){return x.id===pid})[0];if(dp)dp.off=!hay;
    markDirty();toast('Es un plato nuevo: tocá “Guardar cambios” para publicarlo.');return true;
  }
  var nom='';
  var res=await cambioRapido(function(c){var p=c.menu.filter(function(x){return x.id===pid})[0];if(!p)return 'Ese plato ya no está en el menú guardado.';p.off=!hay;nom=p.nom});
  if(!res.ok){toast(res.msg);return false}
  toast(hay?'“'+nom+'” vuelve a estar disponible.':'“'+nom+'” figura agotado en tu tienda.');
  return true;
}

/* ---------- Varios dispositivos a la vez ----------
   Cada guardado lleva el número de versión con el que se cargó el menú. Si otro dispositivo guardó en el medio,
   el servidor no pisa nada: el panel combina los dos juegos de cambios y vuelve a guardar. */
var cl=function(v){return v===undefined?undefined:clone(v)};
function igual(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function listaConId(x){return Array.isArray(x)&&x.length>0&&x.every(function(e){return e&&typeof e==='object'&&'id' in e})}
/* Combina dato por dato: lo que cambiaste vos, más lo que cambió el otro. Si los dos tocaron lo mismo, queda lo tuyo. */
function combinar(base,mio,suyo,ch){
  if(igual(mio,base))return cl(suyo);
  if(igual(suyo,base)||igual(mio,suyo))return cl(mio);
  if(Array.isArray(mio)&&Array.isArray(suyo)&&(listaConId(mio)||listaConId(suyo)||listaConId(base)))return combinarLista(Array.isArray(base)?base:[],mio,suyo,ch);
  if(mio&&suyo&&typeof mio==='object'&&typeof suyo==='object'&&!Array.isArray(mio)&&!Array.isArray(suyo)){
    var out={},ks={},b0=base&&typeof base==='object'?base:{};
    [b0,mio,suyo].forEach(function(o){Object.keys(o).forEach(function(k){ks[k]=1})});
    Object.keys(ks).forEach(function(k){var v=combinar(b0[k],mio[k],suyo[k],ch);if(v!==undefined)out[k]=v});
    return out;
  }
  ch.n++;return cl(mio);
}
/* Platos, categorías, extras y barrios: se combinan por identificador (altas, bajas y cambios de cada uno). */
function combinarLista(base,mio,suyo,ch){
  var B={},M={},T={},out=[],visto={};
  base.forEach(function(e){B[e.id]=e});mio.forEach(function(e){M[e.id]=e});suyo.forEach(function(e){T[e.id]=e});
  function uno(id){
    var b=B[id],m=M[id],t=T[id];
    if(b&&!m){if(t&&!igual(t,b))ch.n++;return null}         /* lo borraste vos */
    if(b&&!t){if(m&&!igual(m,b)){ch.n++;return cl(m)}return null} /* lo borró el otro */
    if(!b)return cl(m||t);                                   /* nuevo */
    return combinar(b,m,t,ch);
  }
  mio.concat(suyo).forEach(function(e){if(visto[e.id])return;visto[e.id]=1;var v=uno(e.id);if(v)out.push(v)});
  return out;
}
/* Cambio chico que se publica al instante (pausa, agotado): se aplica sobre lo último del servidor. */
async function cambioRapido(aplicar){
  var base=S.cfg;
  for(var i=0;i<3;i++){
    var c=clone(base),err=aplicar(c),r,j;
    if(err)return {ok:false,msg:err};
    try{r=await aFetch('/api/menu',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(c)});j=await r.json().catch(function(){return null})}
    catch(e){return {ok:false,msg:'No pudimos conectar.'}}
    if(r.ok&&j&&j.config){
      S.cfg=j.config;
      if(!A.dirty){A.draft=clone(j.config);A.base=clone(j.config)}
      else if(A.draft.rev===c.rev){aplicar(A.draft);aplicar(A.base);A.draft.rev=A.base.rev=j.config.rev}
      else aplicar(A.draft);
      return {ok:true,cfg:j.config};
    }
    if(r.status===409&&j&&j.config){base=S.cfg=j.config;continue}
    return {ok:false,msg:(j&&j.mensaje)||'No se pudo cambiar.'};
  }
  return {ok:false,msg:'Hay muchos cambios a la vez. Probá de nuevo.'};
}
function abrirStock(){
  $('#sBuscar').value='';pintarStock();$('#dStock').showModal();
}
function pintarStock(){
  var q=$('#sBuscar').value.trim().toLowerCase(),d=A.draft,h='';
  d.categorias.forEach(function(c){
    var ps=d.menu.filter(function(p){return p.cat===c.id&&(!q||p.nom.toLowerCase().indexOf(q)>-1)});
    if(!ps.length)return;
    h+='<h4>'+esc(c.nom)+'</h4>'+ps.map(function(p){return '<div class="mrow'+(p.off?' off':'')+'"><div><b>'+esc(p.nom)+'</b><small class="mono">'+money(p.precio)+(p.off?' · agotado':p.quedan===0?' · se agotó':Number.isInteger(p.quedan)?' · quedan '+p.quedan:'')+'</small></div><label class="sw"><input type="checkbox" data-sp="'+esc(p.id)+'"'+(p.off?'':' checked')+' aria-label="Hay '+esc(p.nom)+'"><span></span></label></div>'}).join('');
  });
  $('#sLista').innerHTML=h||'<p class="note">No hay platos con ese nombre.</p>';
}
$('#sBuscar').addEventListener('input',pintarStock);
$('#sLista').addEventListener('change',async function(e){
  var el=e.target;if(!el.hasAttribute('data-sp'))return;
  el.disabled=true;var ok=await stockInstant(el.getAttribute('data-sp'),el.checked);el.disabled=false;
  if(!ok)el.checked=!el.checked;
  pintarStock();if(A.tab==='pedidos'){var s=$('#oStat');if(s)s.innerHTML=barraEstado()}
});

function exportarCSV(){
  var hoy=hoyAR(),os=A.orders.filter(function(o){return hoyAR(new Date(o.creado))===hoy});
  if(!os.length){toast('Hoy todavía no hay pedidos para descargar.');return}
  var rows=[['Número','Fecha','Hora','Estado','Cliente','Teléfono','Entrega','Barrio','Dirección','Hora de retiro','Productos','Subtotal','Envío','Total','Pago','Transferencia recibida','Motivo de rechazo']];
  os.slice().reverse().forEach(function(o){rows.push([o.numero,fechaTxt(hoyAR(new Date(o.creado))),hhmmDe(o.creado),ESTADO_TXT[o.estado],o.cliente.nombre,o.cliente.tel,MODO_TXT[modoDe(o)],o.entrega.zona,o.entrega.dir,o.entrega.hora,
    o.items.map(function(i){return i.qty+'x '+itNom(i)+(i.extras.length?' (+'+i.extras.join(', ')+')':'')}).join(' | '),o.subtotal,o.envio,o.total,o.pago.metodo==='efectivo'?'Efectivo':'Transferencia',o.pago.metodo==='transferencia'?(o.pago.pagado?'Sí':'No'):'',o.motivo||''])});
  var csv='﻿'+rows.map(function(r){return r.map(function(v){v=String(v==null?'':v);return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(';')}).join('\r\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='pedidos-'+hoy+'.csv';
  document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
  toast('Planilla descargada. Se abre con Excel o Google Sheets.');
}
function imprimir(id){
  var o=buscarPedido(id);if(!o)return;
  var v=vuelto(o);
  var L='<h1>'+esc(S.cfg.nombre)+'</h1><div>Comanda '+numPed(o)+' · '+esc(hora(o.creado))+'</div><hr>'+
    '<div><b>'+esc(modoTxt(o))+'</b> · '+esc(entregaAdm(o))+'</div><div>'+esc(o.cliente.nombre)+' · '+esc(o.cliente.tel)+'</div><hr>'+
    o.items.map(function(i){return '<div><b>'+i.qty+'x '+esc(itNom(i))+'</b> <span style="float:right">'+money(i.unit*i.qty)+'</span></div>'+(i.extras.length?'<div>&nbsp;&nbsp;+ '+esc(i.extras.join(', '))+'</div>':'')+(i.nota?'<div>&nbsp;&nbsp;“'+esc(i.nota)+'”</div>':'')}).join('')+'<hr>'+
    (o.envio?'<div>Envío <span style="float:right">'+money(o.envio)+'</span></div>':'')+'<div><b>TOTAL <span style="float:right">'+money(o.total)+'</span></b></div>'+
    '<div>Pago: '+esc(o.pago.metodo==='efectivo'?'Efectivo':o.pago.pagado?'Transferencia (recibida)':'Transferencia (pendiente)')+'</div>'+
    (o.pago.cambio?'<div>Paga con: '+esc(cambioTxt(o))+(v?' · Vuelto: '+money(v):'')+'</div>':'')+
    (o.nota?'<hr><div>Nota: '+esc(o.nota)+'</div>':'')+(o.notaLocal?'<div>Interna: '+esc(o.notaLocal)+'</div>':'')+'<hr><div style="text-align:center">Pedidos con Minuta</div>';
  $('#printArea').innerHTML=L;document.body.classList.add('printing');
  setTimeout(function(){window.print();setTimeout(function(){document.body.classList.remove('printing')},300)},50);
}
function beep(forzar){
  if(!A.sonido&&!forzar)return;
  try{
    var c=A.ctx;if(!c){A.ctx=c=new (window.AudioContext||window.webkitAudioContext)()}if(c.state==='suspended')c.resume();
    /* Campana: dos parciales con caída larga. */
    [[1318,.18],[1976,.08],[880,.1]].forEach(function(p,k){
      var o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=p[0];o.connect(g);g.connect(c.destination);
      var t=c.currentTime+k*0.02;g.gain.setValueAtTime(p[1],t);g.gain.exponentialRampToValueAtTime(0.0001,t+1.4);o.start(t);o.stop(t+1.5);
    });
  }catch(e){}
}
/* Alarma: mientras haya pedidos sin aceptar, vuelve a sonar. */
function alarma(){if(A.sonido&&A.alarma&&A.tok&&A.orders.some(function(o){return o.estado==='nuevo'}))beep()}
function avisoNavegador(o){
  try{
    if(!('Notification' in window)||Notification.permission!=='granted'||document.visibilityState==='visible')return;
    var n=new Notification('Pedido nuevo '+numPed(o)+' · '+money(o.total),{body:o.cliente.nombre+' · '+modoTxt(o),tag:o.id,icon:'/brand/minuta-mark.png'});
    n.onclick=function(){window.focus();aShow('pedidos');n.close()};
  }catch(e){}
}
/* Consulta siempre, también con la pestaña en segundo plano: así no se pierde ningún pedido. */
function mezclarPedidos(lista){
  var m={};A.orders.forEach(function(o){m[o.id]=o});lista.forEach(function(o){m[o.id]=o});
  A.orders=Object.keys(m).map(function(k){return m[k]}).sort(function(a,b){return a.creado<b.creado?1:a.creado>b.creado?-1:0});
  if(A.orders.length>1500)A.orders.length=1500;
}
/* Si otro dispositivo guardó el menú: si acá no hay nada sin guardar, se actualiza solo. */
async function revisarVersion(rev){
  if(!S.cfg||typeof rev!=='number'||rev<=(S.cfg.rev||0)||A.cargandoRev)return;
  A.cargandoRev=true;
  try{
    if((await cargarConfig(true))!=='ok')return;
    pintarPill();
    if(!A.dirty&&!$('#dEdit').open&&!$('#dPrecios').open){
      A.draft=clone(S.cfg);A.base=clone(S.cfg);
      if(A.tab==='menu')renderMenuAdm();else if(A.tab==='local')renderLocal();
      if(A.tab!=='pedidos')toast('Se actualizó con cambios de otro dispositivo.');
    }else if(A.dirty)aMsg('Hay cambios sin guardar. Otro dispositivo también guardó: al guardar se combinan.');
  }finally{A.cargandoRev=false}
}
/* Consulta siempre, también con la pestaña en segundo plano: así no se pierde ningún pedido.
   Cada 5 minutos (o al volver a la pestaña) trae el día completo; el resto, solo lo nuevo y lo que está en curso. */
var aPollEnCurso=false;
async function aPoll(){
  if(aPollEnCurso)return;aPollEnCurso=true;
  try{
    var full=Date.now()-(A.ultFull||0)>5*60000;
    /* Si nada cambió desde la última consulta, el servidor no manda pedidos (casi no gasta base de datos). */
    var r=await aFetch('/api/orders'+(full?'?todo=1':typeof A.orev==='number'?'?rev='+A.orev:''));if(!r.ok)return;
    var j=await r.json();if(!j.sinCambios)mezclarPedidos(j.orders);A.estado=j.estado;A.orev=j.rev;if(full)A.ultFull=Date.now();
    revisarVersion(j.cfgRev);
    var nuevos=[];
    j.orders.forEach(function(o){if(!A.seen.has(o.id)){A.seen.add(o.id);if(o.estado==='nuevo'){A.fresh[o.id]=1;nuevos.push(o)}}});
    if(nuevos.length){beep();toast(nuevos.length>1?'Entraron '+nuevos.length+' pedidos nuevos.':'Entró el pedido '+numPed(nuevos[0])+'.');nuevos.forEach(avisoNavegador);try{if(navigator.vibrate)navigator.vibrate([120,80,120])}catch(e){}}
    if(A.tab==='pedidos'&&!$('#dRech').open)refrescarPedidos();
    else pintarLista();
  }catch(e){}finally{aPollEnCurso=false}
}

/* ----- Menú (grilla) ----- */
function fld(label,path,val,kind,opt){
  opt=opt||{};
  return '<label class="f">'+label+'<input data-p="'+path+'" data-k="'+kind+'" type="'+(opt.type||'text')+'"'+(kind==='i'?' inputmode="numeric"':'')+(opt.max?' maxlength="'+opt.max+'"':'')+(opt.ph?' placeholder="'+esc(opt.ph)+'"':'')+' value="'+esc(val==null?'':val)+'">'+(opt.help?'<small class="help">'+esc(opt.help)+'</small>':'')+'</label>';
}
function thumb(p,cls){return p.foto?'<img class="'+cls+'" alt="" loading="lazy" src="'+esc(fotoUrl(p.id,p.foto))+'">':'<span class="'+cls+' sinfoto">'+ico('foto')+'<small>Sin foto</small></span>'}
function pcardHtml(p,pi){
  var tg=(p.tags||[]).map(function(k){return TAGS[k]?'<span class="tag '+k+'">'+TAGS[k]+'</span>':''}).join('');
  return '<div class="pcard'+(agot(p)?' off':'')+'" data-edit="'+pi+'">'+
    '<div class="pimg">'+thumb(p,'pim')+'<button class="star" data-a="dest" data-i="'+pi+'" aria-pressed="'+!!p.destacado+'" aria-label="Destacar '+esc(p.nom)+'" title="Destacado arriba del menú">'+ico('star')+'</button>'+(agot(p)?'<span class="ribbon">Agotado</span>':'')+'</div>'+
    '<div class="pbody"><b class="pnom">'+esc(p.nom)+'</b>'+(tg||p.extras||conTamanos(p)?'<div class="tags">'+tg+(conTamanos(p)?'<span class="tag ex">'+p.variantes.length+' tamaños</span>':'')+(p.extras?'<span class="tag ex">+ extras</span>':'')+'</div>':'')+
    (conTamanos(p)?'<div class="pprice" title="Se cambia en Editar"><span class="mute" style="font-size:12px">desde</span> <b class="mono">'+money(p.precio)+'</b></div>':'<label class="pprice"><span>$</span><input data-p="menu.'+pi+'.precio" data-k="i" inputmode="numeric" value="'+esc(Number(p.precio||0).toLocaleString('es-AR'))+'" aria-label="Precio de '+esc(p.nom)+'"></label>')+'</div>'+
    '<div class="pfoot"><label class="sw" title="Hay / no hay"><input type="checkbox" data-a="hay" data-i="'+pi+'"'+(p.off?'':' checked')+' aria-label="Hay '+esc(p.nom)+'"><span></span></label><span class="hay">'+(agot(p)?'Agotado':Number.isInteger(p.quedan)?'Quedan '+p.quedan:'Hay')+'</span><button class="btn sm ghost" data-a="edit" data-i="'+pi+'">Editar</button></div></div>';
}
function renderMenuAdm(){
  var d=A.draft,h='<div class="sh" style="margin-top:22px"><h2>Menú</h2><p>Tus platos, ordenados por categoría. Tocá un plato para cambiar su foto, descripción o tamaños.</p></div>',q=A.mq.trim().toLowerCase(),f=A.mf||'todos';
  var match=function(p){if(q&&(p.nom+' '+p.desc).toLowerCase().indexOf(q)<0)return false;if(f==='off')return p.off;if(f==='sinfoto')return !p.foto;if(f==='dest')return p.destacado;return true};
  var cnt={todos:d.menu.length,off:0,sinfoto:0,dest:0};
  d.menu.forEach(function(p){if(p.off)cnt.off++;if(!p.foto)cnt.sinfoto++;if(p.destacado)cnt.dest++});
  h+='<div class="toolbar"><input type="search" id="mBuscar" placeholder="Buscar un plato" value="'+esc(A.mq)+'" aria-label="Buscar productos"><button class="btn ghost" data-a="precios">%&nbsp; Actualizar precios</button><button class="btn ghost" data-a="addc">+ Categoría</button></div>';
  h+='<div class="chips mf">'+[['todos','Todos'],['off','Agotados'],['sinfoto','Sin foto'],['dest','Destacados']].map(function(x){return '<button data-a="mf" data-v="'+x[0]+'" aria-pressed="'+(f===x[0])+'">'+x[1]+' <span class="mono">'+cnt[x[0]]+'</span></button>'}).join('')+'</div>';
  if(d.categorias.length>1&&!q&&f==='todos')h+='<nav class="mjump" aria-label="Ir a una categoría">'+d.categorias.map(function(c){var n=d.menu.filter(function(p){return p.cat===c.id}).length;return '<button data-a="jump" data-v="'+esc(c.id)+'">'+esc(c.nom)+' <span class="mono">'+n+'</span></button>'}).join('')+'</nav>';
  h+='<p class="note">Tocá un plato para editarlo y subirle foto. El precio se cambia ahí mismo. El interruptor de “Hay” se publica al instante; lo demás, con “Guardar cambios”.</p>';
  var algo=false;
  d.categorias.forEach(function(c,ci){
    var items=d.menu.map(function(p,pi){return [p,pi]}).filter(function(x){return x[0].cat===c.id&&match(x[0])});
    if((q||f!=='todos')&&!items.length)return;
    algo=true;
    h+='<section class="mcat" id="mc-'+esc(c.id)+'"><div class="ch"><input data-p="categorias.'+ci+'.nom" data-k="s" maxlength="40" aria-label="Nombre de la categoría" value="'+esc(c.nom)+'"><span class="mono mute n">'+items.length+'</span><button class="btn sm ghost" data-a="cup" data-i="'+ci+'" aria-label="Subir categoría" title="Subir categoría">▲</button><button class="btn sm ghost" data-a="cdn" data-i="'+ci+'" aria-label="Bajar categoría" title="Bajar categoría">▼</button><button class="btn sm ghost ic" data-a="delc" data-i="'+ci+'" aria-label="Borrar categoría" title="Borrar categoría">'+ico('x')+'</button></div>';
    h+='<div class="pgrid">'+items.map(function(x){return pcardHtml(x[0],x[1])}).join('')+
      (!q&&f==='todos'?'<button class="padd" data-a="addp" data-c="'+esc(c.id)+'"><b>+</b>Agregar plato</button>':'')+'</div></section>';
  });
  if(!algo)h+='<p class="note">No hay platos que coincidan. <button class="lk" data-a="mf" data-v="todos">Ver todos</button></p>';
  h+='<div class="box"><h4 role="heading" aria-level="3">Extras</h4><p class="note" style="margin-top:0">Se ofrecen en los platos que tengan marcado “Se puede pedir con extras”.</p><div class="xgrid">';
  d.extras.forEach(function(x,i){
    h+='<div class="ad"><input data-p="extras.'+i+'.nom" data-k="s" maxlength="40" aria-label="Nombre del extra" value="'+esc(x.nom)+'"><input data-p="extras.'+i+'.precio" data-k="i" inputmode="numeric" aria-label="Precio del extra" value="'+esc(x.precio)+'"><button class="btn sm ghost" data-a="dele" data-i="'+i+'" aria-label="Borrar extra">'+ico('x')+'</button></div>';
  });
  h+='</div><div class="acts"><button class="btn sm ghost" data-a="adde">+ Agregar extra</button></div></div>';
  $('#t-menu').innerHTML=h;
}
/* Tamaños o porciones con precio propio: chica / grande, 8 / 12 porciones. */
function tamanosHtml(p,pi){
  var vs=p.variantes||[];
  var h='<div class="f">Tamaños o porciones <small class="help">Opcional. Si cargás tamaños, el cliente elige uno y paga el precio de ese tamaño.</small></div>';
  vs.forEach(function(v,k){
    h+='<div class="ad"><input data-p="menu.'+pi+'.variantes.'+k+'.nom" data-k="s" maxlength="30" aria-label="Nombre del tamaño" placeholder="Ej: Grande" value="'+esc(v.nom)+'"><input data-p="menu.'+pi+'.variantes.'+k+'.precio" data-k="i" inputmode="numeric" aria-label="Precio del tamaño" value="'+esc(v.precio)+'"><button class="btn sm ghost" data-ea="delv" data-v="'+k+'" aria-label="Quitar tamaño">'+ico('x')+'</button></div>';
  });
  return h+'<div class="acts" style="margin:6px 0 10px"><button class="btn sm ghost" data-ea="addv">'+(vs.length?'+ Otro tamaño':'+ Agregar tamaños')+'</button></div>';
}
function abrirEditor(pi){
  A.edit=pi;var p=A.draft.menu[pi],d=A.draft;
  var sel=d.categorias.map(function(c){return '<option value="'+esc(c.id)+'"'+(c.id===p.cat?' selected':'')+'>'+esc(c.nom)+'</option>'}).join('');
  var h='<div class="photo">'+(p.foto?'<img alt="" src="'+esc(fotoUrl(p.id,p.foto))+'">':'<div class="ph0">Sin foto</div>')+'<div class="acts" style="margin:0"><label class="btn sm filebtn">'+ico('foto')+(p.foto?'Cambiar foto':'Subir foto')+'<input type="file" id="fotoFile" accept="image/*" hidden></label>'+(p.foto?'<button class="btn sm ghost" data-ea="nofoto">Quitar</button>':'')+'</div></div><small class="help">Foto real del plato, con buena luz. Se achica sola.</small>'+
    fld('Nombre','menu.'+pi+'.nom',p.nom,'s',{max:60})+
    '<label class="f">Descripción<textarea data-p="menu.'+pi+'.desc" data-k="s" maxlength="160" rows="2">'+esc(p.desc)+'</textarea></label>'+
    '<div class="two">'+(conTamanos(p)?'<div class="f">Precio<div class="note" style="margin:6px 0 0">Desde <b>'+money(p.precio)+'</b> (el menor tamaño)</div></div>':fld('Precio ($)','menu.'+pi+'.precio',p.precio,'i'))+'<label class="f">Categoría<select data-p="menu.'+pi+'.cat" data-k="s">'+sel+'</select></label></div>'+
    tamanosHtml(p,pi)+
    '<div class="f">Etiquetas</div><div class="checks">'+Object.keys(TAGS).map(function(k){return '<label class="chk"><input type="checkbox" data-tag="'+k+'"'+((p.tags||[]).indexOf(k)>-1?' checked':'')+'> '+TAGS[k]+'</label>'}).join('')+'</div>'+
    '<div class="checks"><label class="chk"><input type="checkbox" data-p="menu.'+pi+'.extras" data-k="b"'+(p.extras?' checked':'')+'> Se puede pedir con extras</label>'+
    '<label class="chk"><input type="checkbox" data-p="menu.'+pi+'.destacado" data-k="b"'+(p.destacado?' checked':'')+'> Destacado</label>'+
    '<label class="chk"><input type="checkbox" data-p="menu.'+pi+'.off" data-k="b"'+(p.off?' checked':'')+'> Hoy no hay</label></div>'+
    '<label class="f">Cantidad disponible (opcional)<input data-p="menu.'+pi+'.stock" data-k="n" inputmode="numeric" maxlength="6" placeholder="Sin límite" value="'+(Number.isInteger(p.stock)?p.stock:'')+'"></label>'+
    '<div class="note" style="margin:-4px 0 10px">Se descuenta sola con cada pedido y, al llegar a 0, el plato figura como agotado.'+(Number.isInteger(p.quedan)?' Ahora quedan <b>'+p.quedan+'</b>.':'')+' Para reponer, escribí la cantidad de nuevo y guardá.</div>'+
    '<p class="err" id="eErr"></p><div class="acts"><button class="btn" data-ea="listo">Listo</button><button class="btn ghost" data-ea="up">◀ Antes</button><button class="btn ghost" data-ea="dn">Después ▶</button><button class="btn ghost" data-ea="dup">Duplicar</button><button class="btn danger" data-ea="del">Borrar</button></div>';
  $('#eBody').innerHTML=h;
  if(!$('#dEdit').open)$('#dEdit').showModal();
}
$('#dEdit').addEventListener('close',function(){A.edit=-1;if(A.tab==='menu')renderMenuAdm()});
['input','change'].forEach(function(ev){$('#eBody').addEventListener(ev,function(e){
  var el=e.target;
  if(el.id==='fotoFile'){if(ev==='change')subirFoto(el.files&&el.files[0],A.draft.menu[A.edit].id,'producto');return}
  if(el.hasAttribute('data-tag')){var p=A.draft.menu[A.edit],t=el.getAttribute('data-tag');p.tags=(p.tags||[]).filter(function(x){return x!==t});if(el.checked)p.tags.push(t);markDirty();return}
  onEdit(e);
})});
$('#eBody').addEventListener('click',function(e){
  var b=e.target.closest('[data-ea]');if(!b)return;
  var a=b.getAttribute('data-ea'),d=A.draft,i=A.edit,p=d.menu[i];
  if(a==='listo'){$('#dEdit').close();return}
  if(a==='nofoto'){p.foto='';markDirty();abrirEditor(i);return}
  if(a==='del'){confirmar('¿Borrar “'+p.nom+'”?',function(){d.menu.splice(i,1);markDirty();$('#dEdit').close();renderMenuAdm();toast('Plato borrado. Guardá para publicar.')});return}
  if(a==='addv'){
    p.variantes=p.variantes||[];
    if(!p.variantes.length){p.variantes.push({id:uid('v'),nom:'Chica',precio:p.precio},{id:uid('v'),nom:'Grande',precio:p.precio})}
    else{if(p.variantes.length>=8){toast('Máximo 8 tamaños.');return}p.variantes.push({id:uid('v'),nom:'',precio:p.variantes[p.variantes.length-1].precio})}
    markDirty();abrirEditor(i);return}
  if(a==='delv'){
    var k=+b.getAttribute('data-v');p.variantes.splice(k,1);
    if(p.variantes.length<2){p.variantes=[];toast('Sin tamaños: el plato vuelve a tener un solo precio.')}
    ajustarPrecio(p);markDirty();abrirEditor(i);return}
  if(a==='dup'){var np=clone(p);np.id=uid('p');np.nom=(p.nom+' (copia)').slice(0,60);np.foto='';d.menu.splice(i+1,0,np);markDirty();abrirEditor(i+1);toast('Copia creada.');return}
  if(a==='up'||a==='dn'){var dir=a==='up'?-1:1,j=i+dir;while(j>=0&&j<d.menu.length&&d.menu[j].cat!==p.cat)j+=dir;if(swap(d.menu,i,j)){markDirty();abrirEditor(j)}return}
});

/* Aumento de precios: por porcentaje, con redondeo, para todo el menú o una categoría. */
function abrirPrecios(){
  var d=A.draft;
  $('#prBody').innerHTML='<p class="note" style="margin-top:12px">Ideal para cuando suben los costos: actualizás todo en un paso y después revisás.</p>'+
    '<div class="two"><label class="f">¿Qué productos?<select id="prCat"><option value="">Todo el menú</option>'+d.categorias.map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.nom)+'</option>'}).join('')+'</select></label>'+
    '<label class="f">Porcentaje<input id="prPct" inputmode="decimal" value="10" aria-describedby="prHelp"><small class="help" id="prHelp">Ej: 10 sube un 10%. Con un menos adelante (-5) baja.</small></label></div>'+
    '<div class="two"><label class="f">Redondear a<select id="prRed"><option value="0">Sin redondear</option><option value="10">$10</option><option value="50">$50</option><option value="100" selected>$100</option><option value="500">$500</option></select></label>'+
    '<label class="chk" style="margin-top:34px"><input type="checkbox" id="prEx"> También los extras</label></div>'+
    '<div id="prPrev" class="prprev"></div><div class="acts" style="margin-top:14px"><button class="btn" id="prOk">Aplicar</button><button class="btn ghost" id="prNo">Cancelar</button></div>';
  calcPrecios();$('#dPrecios').showModal();
}
function nuevosPrecios(){
  var pct=parseFloat(String($('#prPct').value).replace(',','.')),red=+$('#prRed').value,cat=$('#prCat').value,d=A.draft;
  if(isNaN(pct)||pct<-90||pct>500)return null;
  var r=function(v){var n=Math.round(v*(1+pct/100));if(red)n=Math.round(n/red)*red;return Math.max(0,n)};
  var ps=[];
  d.menu.filter(function(p){return !cat||p.cat===cat}).forEach(function(p){
    if(conTamanos(p))p.variantes.forEach(function(v){ps.push({o:v,de:v.precio,a:r(v.precio),n:p.nom+' ('+v.nom+')'})});
    else ps.push({o:p,de:p.precio,a:r(p.precio)});
  });
  var xs=$('#prEx').checked?d.extras.map(function(x){return {o:x,de:x.precio,a:r(x.precio)}}):[];
  return ps.concat(xs);
}
function calcPrecios(){
  var l=nuevosPrecios(),el=$('#prPrev');
  if(!l){el.innerHTML='<p class="err">Escribí un porcentaje entre -90 y 500.</p>';$('#prOk').disabled=true;return}
  var cambian=l.filter(function(x){return x.a!==x.de});
  $('#prOk').disabled=!cambian.length;
  el.innerHTML='<b>'+cambian.length+' precio'+(cambian.length===1?'':'s')+' cambia'+(cambian.length===1?'':'n')+'</b>'+cambian.slice(0,8).map(function(x){return '<div class="mrow"><span>'+esc(x.n||x.o.nom)+'</span><span class="mono"><s class="mute">'+money(x.de)+'</s> → <b>'+money(x.a)+'</b></span></div>'}).join('')+(cambian.length>8?'<p class="note">y '+(cambian.length-8)+' más…</p>':'');
}
$('#prBody').addEventListener('input',function(e){if(e.target.closest('#prPrev'))return;calcPrecios()});
$('#prBody').addEventListener('change',calcPrecios);
$('#prBody').addEventListener('click',function(e){
  if(e.target.id==='prNo'){$('#dPrecios').close();return}
  if(e.target.id!=='prOk')return;
  var l=nuevosPrecios();if(!l)return;
  var n=0;l.forEach(function(x){if(x.o.precio!==x.a){x.o.precio=x.a;n++}});
  A.draft.menu.forEach(ajustarPrecio);
  $('#dPrecios').close();
  if(n){markDirty();renderMenuAdm();toast(n+' precios actualizados. Revisalos y tocá “Guardar cambios”.')}
});

/* ----- Mi local ----- */
var SWATCHES=['#8e1b2c','#b91c1c','#c2410c','#d97706','#ca8a04','#15803d','#1f6b5c','#0f766e','#1d4ed8','#6d28d9','#be185d','#231c19'];
function previewHtml(){
  var d=A.draft,col=okColor(d.color),on=onColor(col),F=FONTS[d.fuente]||FONTS.bodegon,est=d.estilo||'color',bg;
  if(est==='banner'&&d.banner)bg='background:#231C19 url(&quot;'+esc(fotoUrl('banner',d.banner))+'&quot;) center/cover';
  else if(est==='mantel')bg='background-color:#FBF6EE;background-image:linear-gradient(90deg,'+col+'73 50%,transparent 0),linear-gradient('+col+'73 50%,transparent 0);background-size:20px 20px';
  else bg='background:'+col;
  return '<div class="prev" id="marcaPrev"><div class="pb" style="'+bg+'"></div><div class="pp">'+(d.logo?'<img src="'+esc(logoUrl(d))+'" alt="">':'')+'<b style="font-family:'+esc(F.f)+';font-weight:'+F.w+'">'+esc(d.nombre||'Tu local')+'</b><span class="btn sm" style="background:'+col+';color:'+on+'">+ Agregar</span></div></div>';
}
function cargarTodasLasFuentes(){
  if($('#allFonts'))return;
  var l=document.createElement('link');l.rel='stylesheet';l.id='allFonts';
  l.href='https://fonts.googleapis.com/css2?'+Object.keys(FONTS).map(function(k){return FONTS[k].g}).filter(Boolean).map(function(g){return 'family='+g}).join('&')+'&display=swap';
  document.head.appendChild(l);
}
function renderLocal(){
  cargarTodasLasFuentes();
  var d=A.draft,hr=d.horario,md=d.modos||{retiro:true,delivery:true},dm=d.demora||{};
  var hrOpt=function(from,to,sel){var o='';for(var n=from;n<=to;n++)o+='<option value="'+n+'"'+(n===sel?' selected':'')+'>'+pad(n)+'</option>';return o};
  var est=d.estilo||'color',NB=0;
  var bx=function(id,t,desc,cls){return '<div class="box'+(cls?' '+cls:'')+'" id="sec-'+id+'"><div class="bh"><span class="bn">'+(++NB)+'</span><div><h4 role="heading" aria-level="3">'+t+'</h4><p>'+desc+'</p></div></div>'};
  var l='<div class="sh" style="margin-top:22px"><h2>Mi local</h2><p>Lo que ven tus clientes y cómo trabaja tu local. Los cambios se publican cuando tocás “Guardar cambios”, abajo.</p></div>'+
  '<nav class="jump" aria-label="Ir a una sección">'+[['marca','Tu marca'],['datos','Datos'],['entrega','Entrega'],['cobro','Cobro'],['horario','Horario'],['mensajes','Mensajes']].map(function(x,i){return '<button type="button" data-jump="'+x[0]+'"><i>'+(i+1)+'</i>'+x[1]+'</button>'}).join('')+'</nav>'+
  bx('marca','Tu marca','Cómo se ve tu tienda: colores, logo y tipografía.','rise')+previewHtml()+
  '<div class="f">Encabezado de tu menú</div><div class="seg" id="estiloSeg">'+[['color','Color'],['banner','Banner con foto'],['mantel','Mantel a cuadros']].map(function(x){return '<button type="button" data-a="estilo" data-v="'+x[0]+'" aria-pressed="'+(est===x[0])+'">'+x[1]+'</button>'}).join('')+'</div>';
  if(est==='banner')l+='<div class="photo wide" style="margin-top:12px">'+(d.banner?'<img alt="" src="'+esc(fotoUrl('banner',d.banner))+'">':'<div class="ph0">Sin banner</div>')+'<div class="acts" style="margin:0"><label class="btn sm filebtn">'+ico('foto')+(d.banner?'Cambiar banner':'Subir banner')+'<input type="file" id="bannerFile" accept="image/*" hidden></label>'+(d.banner?'<button class="btn sm ghost" data-a="nobanner">Quitar</button>':'')+'</div></div><small class="help">Una foto horizontal del local o de un plato. Ideal 1600×600.</small>';
  l+='<div class="f">Color de tu tienda</div><div class="swatches">'+SWATCHES.map(function(c){return '<button type="button" class="swb'+(c===d.color?' on':'')+'" style="background:'+c+'" data-a="swatch" data-c="'+c+'" aria-label="Color '+c+'"></button>'}).join('')+
  '<label class="swb custom" title="Otro color"><input type="color" data-p="color" data-k="s" value="'+esc(okColor(d.color))+'" aria-label="Elegir otro color"></label></div>';
  l+='<div class="f">Logo</div><div class="photo">'+(d.logo?'<img alt="Tu logo" src="'+esc(logoUrl(d))+'" style="object-fit:contain;background:#fff">':'<div class="ph0">Sin logo</div>')+'<div class="acts" style="margin:0"><label class="btn sm ghost filebtn">'+(d.logo?'Cambiar logo':'Subir logo')+'<input type="file" id="logoFile" accept="image/*" hidden></label>'+(d.logo?'<button class="btn sm ghost" data-a="nologo">Quitar</button>':'')+'</div></div>';
  l+='<div class="f">Tipografía de tu menú</div><div class="fonts">'+Object.keys(FONTS).map(function(k){var F=FONTS[k];return '<button type="button" data-a="fuente" data-v="'+k+'" aria-pressed="'+(d.fuente===k)+'"><b style="font-family:'+esc(F.f)+';font-weight:'+F.w+'">'+F.n+'</b><small>'+esc(F.d)+'</small></button>'}).join('')+'</div></div>';

  l+=bx('datos','Datos del local','Lo que ven tus clientes arriba del menú.')+fld('Nombre del local','nombre',d.nombre,'s',{max:40})+fld('Frase de bienvenida','descripcion',d.descripcion,'s',{max:140})+
  fld('Dirección del local','direccion',d.direccion,'s',{max:120,ph:'Av. San Martín 1234, Luján',help:'Se muestra en tu menú con un link a Google Maps, y va en los mensajes de retiro.'})+
  (d.direccion?'<p class="lnk"><a target="_blank" rel="noopener" href="'+esc(mapsUrl(d.direccion))+'">Ver en el mapa</a></p>':'')+
  '<div class="two">'+fld('Instagram (sin @)','instagram',d.instagram,'s',{max:40,ph:'tulocal'})+fld('Aviso destacado','anuncio',d.anuncio,'s',{max:140,ph:'Hoy 2x1 en milanesas',help:'Aparece arriba del menú. Dejalo vacío para ocultarlo.'})+'</div></div>';

  l+=bx('entrega','Formas de entrega','Cómo reciben el pedido, cuánto tarda y cuánto cuesta el envío.')+
  [['retiro','Retiro en el local','El cliente pasa a buscar su pedido.'],['delivery','Delivery','Con costo por barrio (cargá los barrios abajo).']].map(function(m){
    return '<div class="mrow"><div><b>'+m[1]+'</b><small>'+m[2]+'</small></div><label class="sw"><input type="checkbox" data-modo="'+m[0]+'"'+(md[m[0]]!==false?' checked':'')+' aria-label="'+m[1]+'"><span></span></label></div>'+
    (m[0]==='retiro'&&md.retiro!==false?'<label class="chk" style="margin:10px 0 4px"><input type="checkbox" data-p="elegirHora" data-k="b"'+(d.elegirHora!==false?' checked':'')+'> Dejar que el cliente elija a qué hora pasa</label>':'');
  }).join('')+
  '<div class="two">'+fld('Demora para retirar (min)','demora.retiro',dm.retiro||'','i',{ph:'25'})+fld('Demora del delivery (min)','demora.delivery',dm.delivery||'','i',{ph:'45'})+'</div>'+
  fld('Pedido mínimo ($)','minimo',d.minimo||'','i',{ph:'0',help:'Dejalo en 0 si no tenés mínimo.'})+
  '<h4 role="heading" aria-level="3">Barrios de envío</h4>';
  d.zonas.forEach(function(z,i){
    l+='<div class="ad"><input data-p="zonas.'+i+'.nom" data-k="s" maxlength="40" aria-label="Barrio" value="'+esc(z.nom)+'"><input data-p="zonas.'+i+'.costo" data-k="i" inputmode="numeric" aria-label="Costo de envío" value="'+esc(z.costo)+'"><button class="btn sm ghost" data-a="delz" data-i="'+i+'" aria-label="Borrar barrio">'+ico('x')+'</button></div>';
  });
  l+='<div class="acts"><button class="btn sm ghost" data-a="addz">+ Agregar barrio</button></div></div>';

  l+=bx('cobro','Contacto y cobro','El WhatsApp donde te escriben los clientes y el alias para las transferencias.')+
  fld('WhatsApp del local','whatsapp',d.whatsapp,'s',{max:20,ph:'5491155550000',help:'Con código de país y sin espacios. Es el que ven tus clientes.'})+
  fld('Alias para transferencias','alias',d.alias,'s',{max:60,ph:'tu.alias.mp',help:'Desde “Pedidos” se lo mandás por WhatsApp a quien paga por transferencia.'})+'</div>';

  var order=[1,2,3,4,5,6,0];
  l+=bx('horario','Horario de atención','Los días y horas en que tu tienda recibe pedidos. Fuera de horario figura cerrada.')+'<div class="checks">'+order.map(function(n){return '<label class="chk"><input type="checkbox" data-day="'+n+'"'+(hr.dias.indexOf(n)>-1?' checked':'')+'> '+DIAS[n]+'</label>'}).join('')+'</div>';
  l+='<div class="two"><label class="f">Abre<select data-p="horario.desde" data-k="i">'+hrOpt(0,23,hr.desde)+'</select></label><label class="f">Cierra<select data-p="horario.hasta" data-k="i">'+hrOpt(1,24,hr.hasta)+'</select></label></div>';
  var partido=hr.desde2!=null&&hr.hasta2!=null;
  l+='<label class="chk" style="margin-top:12px"><input type="checkbox" data-split'+(partido?' checked':'')+'> Cierro al mediodía y vuelvo a abrir (horario partido)</label>';
  if(partido)l+='<div class="two"><label class="f">Vuelve a abrir<select data-p="horario.desde2" data-k="i">'+hrOpt(0,23,hr.desde2)+'</select></label><label class="f">Cierra de nuevo<select data-p="horario.hasta2" data-k="i">'+hrOpt(1,24,hr.hasta2)+'</select></label></div>';
  l+='<p class="note">Hora de Argentina. Si cerrás después de medianoche, poné una hora de cierre menor a la de apertura (abre 20:00, cierra 02:00).'+(partido?' Los dos turnos no pueden pisarse.':'')+'</p></div>';
  l+=bx('mensajes','Mensajes por WhatsApp','Cuando un pedido queda listo o sale en camino, te aparece un botón para avisarle al cliente con un toque. Acá cambiás el texto; si lo dejás vacío se usa el de siempre.')+
  '<label class="f">Pedido listo para retirar<textarea data-p="msgListo" data-k="s" rows="2" maxlength="300" placeholder="'+esc(msgListoDef({cliente:{nombre:'{nombre}'},numero:'{numero}',entrega:{modo:'retiro'}}))+'">'+esc(d.msgListo||'')+'</textarea></label>'+
  '<label class="f">Pedido en camino<textarea data-p="msgCamino" data-k="s" rows="2" maxlength="300" placeholder="¡Hola {nombre}! Tu pedido #{numero} ya salió y va en camino a {direccion}.">'+esc(d.msgCamino||'')+'</textarea></label>'+
  '<small class="help">Podés usar: {nombre} {numero} {local} {direccion} {total} {seguimiento}</small></div>';

  $('#t-local').innerHTML=l;
}
/* Con tamaños, el precio del plato es el menor ("desde"). */
function ajustarPrecio(p){if(p.variantes&&p.variantes.length)p.precio=Math.min.apply(null,p.variantes.map(function(v){return +v.precio||0}))}
$('#t-local').addEventListener('click',function(e){
  var b=e.target.closest('[data-jump]');if(!b)return;
  var t=document.getElementById('sec-'+b.getAttribute('data-jump'));if(t)t.scrollIntoView({behavior:'smooth',block:'start'});
});
function setPath(o,path,v){var k=path.split('.');for(var i=0;i<k.length-1;i++){if(o[k[i]]==null)o[k[i]]={};o=o[k[i]]}o[k[k.length-1]]=v}
function onEdit(e){
  var el=e.target;
  if(el.id==='logoFile'){if(e.type==='change')procesarLogo(el.files&&el.files[0]);return}
  if(el.id==='bannerFile'){if(e.type==='change')subirFoto(el.files&&el.files[0],'banner','banner');return}
  if(el.id==='mBuscar'){A.mq=el.value;renderMenuAdm();var m=$('#mBuscar');m.focus();m.setSelectionRange(m.value.length,m.value.length);return}
  if(el.hasAttribute('data-day')){
    if(e.type!=='change')return;
    var n=+el.getAttribute('data-day'),ds=A.draft.horario.dias,ix=ds.indexOf(n);
    if(el.checked&&ix<0)ds.push(n);if(!el.checked&&ix>-1)ds.splice(ix,1);
    markDirty();return;
  }
  if(el.hasAttribute('data-split')){
    if(e.type!=='change')return;var hh=A.draft.horario;
    if(el.checked){if(hh.hasta>=1&&hh.hasta<=18&&hh.desde<hh.hasta){hh.desde2=20;hh.hasta2=24}else{hh.desde2=12;hh.hasta2=15}}else{hh.desde2=null;hh.hasta2=null}
    markDirty();renderLocal();return}
  if(el.hasAttribute('data-modo')){if(e.type!=='change')return;A.draft.modos=A.draft.modos||{};A.draft.modos[el.getAttribute('data-modo')]=el.checked;delete A.draft.modos.takeaway;markDirty();renderLocal();return}
  if(el.getAttribute('data-a')==='hay'){
    if(e.type!=='change')return;
    var p0=A.draft.menu[+el.getAttribute('data-i')];el.disabled=true;
    stockInstant(p0.id,el.checked).then(function(){if(A.tab==='menu')renderMenuAdm()});
    return;
  }
  var p=el.getAttribute('data-p');if(!p)return;
  var k=el.getAttribute('data-k');
  var v=k==='b'?el.checked:k==='i'?(parseInt(String(el.value).replace(/\D/g,''),10)||0):k==='n'?(String(el.value).replace(/\D/g,'')===''?null:parseInt(String(el.value).replace(/\D/g,''),10)):el.value;
  setPath(A.draft,p,v);
  if(k==='n'){var pr=A.draft.menu[+p.split('.')[1]];if(pr){pr.reponer=true;if(v===null)delete pr.quedan}}
  markDirty();
  if(/^menu\.\d+\.variantes\./.test(p))ajustarPrecio(A.draft.menu[+p.split('.')[1]]);
  if(p==='color'||p==='nombre'){var pv=$('#marcaPrev');if(pv)pv.outerHTML=previewHtml();if(p==='color')$$('.swb[data-c]').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-c')===v)})}
}
['input','change'].forEach(function(ev){$('#aApp').addEventListener(ev,function(e){if(A.tab==='menu'||A.tab==='local')onEdit(e)})});

/* Imágenes: se achican en el navegador para que pesen poco. */
function achicar(file,maxW,maxH,limite,cb){
  if(!file)return;
  if(!/^image\//.test(file.type)){toast('Elegí una imagen (PNG, JPG o WebP).');return}
  var fr=new FileReader();
  fr.onerror=function(){toast('No pudimos leer la imagen.')};
  fr.onload=function(){
    var im=new Image();
    im.onerror=function(){toast('No pudimos abrir esa imagen. Probá con un JPG.')};
    im.onload=function(){
      var k=Math.min(1,maxW/im.width,maxH/im.height),out='';
      for(var tries=0;tries<5&&!out;tries++){
        var w=Math.max(1,Math.round(im.width*k)),h=Math.max(1,Math.round(im.height*k));
        var c=document.createElement('canvas');c.width=w;c.height=h;
        var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);
        var q=[.82,.75,.68,.6,.5][tries];
        var u=c.toDataURL('image/webp',q);if(u.indexOf('data:image/webp')!==0)u=c.toDataURL('image/jpeg',q);
        if(u.length<=limite)out=u;else k*=.85;
      }
      if(!out){toast('Esa imagen es muy pesada. Probá con otra.');return}
      cb(out);
    };
    im.src=fr.result;
  };
  fr.readAsDataURL(file);
}
function subirFoto(file,id,tipo){
  var big=tipo==='banner',T={banner:[1600,800,400000],logo:[256,256,140000],producto:[800,800,150000]}[tipo]||[800,800,150000];
  toast(tipo==='logo'?'Subiendo el logo…':'Subiendo la foto…');
  achicar(file,T[0],T[1],T[2],async function(data){
    try{
      var r=await aFetch('/api/foto',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({id:id,data:data})});
      var j=await r.json().catch(function(){return null});
      if(!r.ok){toast((j&&j.mensaje)||'No se pudo subir la foto.');return}
      if(big){A.draft.banner=j.v;A.draft.estilo='banner';markDirty();renderLocal()}
      else if(tipo==='logo'){A.draft.logo=j.v;markDirty();renderLocal()}
      else{var p=A.draft.menu.filter(function(x){return x.id===id})[0];if(p){p.foto=j.v;markDirty();if(A.edit>-1)abrirEditor(A.edit)}}
      toast('Foto lista. Tocá “Guardar cambios” para publicarla.');
    }catch(e){toast('No pudimos conectar para subir la foto.')}
  });
}
function procesarLogo(file){subirFoto(file,'logo','logo')}

function swap(arr,i,j){if(j<0||j>=arr.length)return false;var t=arr[i];arr[i]=arr[j];arr[j]=t;return true}
$('#aApp').addEventListener('click',function(e){
  var row=e.target.closest('[data-edit]');
  var b=e.target.closest('[data-a]');
  if(row&&!b&&!e.target.closest('label,input')){abrirEditor(+row.getAttribute('data-edit'));return}
  if(!b||b.tagName==='INPUT')return;
  var a=b.getAttribute('data-a'),i=+b.getAttribute('data-i'),d=A.draft;
  switch(a){
    case 'swatch':d.color=b.getAttribute('data-c');break;
    case 'estilo':d.estilo=b.getAttribute('data-v');break;
    case 'fuente':d.fuente=b.getAttribute('data-v');break;
    case 'nologo':d.logo='';break;
    case 'nobanner':d.banner='';if(d.estilo==='banner')d.estilo='color';break;
    case 'dest':d.menu[i].destacado=!d.menu[i].destacado;b.setAttribute('aria-pressed',d.menu[i].destacado);markDirty();toast(d.menu[i].destacado?'Destacado. Guardá para publicarlo.':'Ya no está destacado.');return;
    case 'edit':abrirEditor(i);return;
    case 'precios':abrirPrecios();return;
    case 'mf':A.mf=b.getAttribute('data-v');renderMenuAdm();return;
    case 'jump':var sec=document.getElementById('mc-'+b.getAttribute('data-v'));if(sec)sec.scrollIntoView({behavior:'smooth',block:'start'});return;
    case 'addc':d.categorias.push({id:uid('c'),nom:'Nueva categoría'});break;
    case 'delc':
      if(d.menu.some(function(p){return p.cat===d.categorias[i].id})){toast('Primero mové o borrá los platos de esa categoría.');return}
      if(d.categorias.length<2){toast('Tiene que quedar al menos una categoría.');return}
      confirmar('¿Borrar la categoría “'+d.categorias[i].nom+'”?',function(){d.categorias.splice(i,1);markDirty();renderMenuAdm()});return;
    case 'cup':swap(d.categorias,i,i-1);break;
    case 'cdn':swap(d.categorias,i,i+1);break;
    case 'addp':var np={id:uid('p'),cat:b.getAttribute('data-c'),nom:'Nuevo plato',desc:'',precio:0,extras:false,off:false,foto:'',destacado:false,tags:[]};d.menu.push(np);markDirty();renderMenuAdm();abrirEditor(d.menu.length-1);return;
    case 'adde':d.extras.push({id:uid('e'),nom:'Nuevo extra',precio:0});break;
    case 'dele':d.extras.splice(i,1);break;
    case 'addz':d.zonas.push({id:uid('z'),nom:'Nuevo barrio',costo:0});break;
    case 'delz':d.zonas.splice(i,1);break;
    default:return;
  }
  markDirty();
  if(A.tab==='menu')renderMenuAdm();else renderLocal();
});

$('#aGuardar').addEventListener('click',async function(){
  var b=this;b.disabled=true;aMsg('Guardando…');
  try{
    var r,j,combinado=null;
    for(var intento=0;intento<3;intento++){
      r=await aFetch('/api/menu',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(A.draft)});
      j=await r.json().catch(function(){return null});
      if(r.status!==409||!j||!j.config)break;
      /* Otro dispositivo guardó en el medio: se combinan los cambios y se vuelve a guardar. */
      var ch={n:0};
      A.draft=combinar(A.base,A.draft,j.config,ch);A.draft.rev=j.config.rev;
      A.base=clone(j.config);S.cfg=j.config;
      combinado={n:(combinado?combinado.n:0)+ch.n};
    }
    if(!r.ok){
      var m=(j&&j.mensaje)||'No se pudo guardar. Probá de nuevo.';
      aMsg(m);b.disabled=false;toast(m);
      if(/WhatsApp|entrega/.test(m)&&A.tab!=='local'){aShow('local');aMsg(m)}
      return;
    }
    S.cfg=j.config;A.draft=clone(j.config);A.base=clone(j.config);A.dirty=false;$('#aSave').classList.remove('dirty');
    $('#aTitulo').textContent=j.config.nombre;pintarPill();
    aMsg('Guardado. Tus clientes ya ven los cambios.');
    if(combinado)toast('Otro dispositivo también había guardado: combinamos sus cambios con los tuyos.'+(combinado.n?' En '+combinado.n+(combinado.n===1?' dato que cambiaron los dos quedó':' datos que cambiaron los dos quedaron')+' tus versiones.':''),{txt:'Ok',fn:function(){}});
    else toast('Guardado.');
    if(A.tab==='menu')renderMenuAdm();else renderLocal();
  }catch(e){aMsg('No pudimos conectar. Probá de nuevo.');b.disabled=false}
});

/* ----- Cuenta ----- */
function fechaTxt(iso){if(!iso)return 'sin fecha';var p=iso.split('-');return p[2]+'/'+p[1]+'/'+p[0]}
async function renderCuenta(){
  var el=$('#t-cuenta');
  if(!A.cuenta){
    el.innerHTML='<p class="note">Cargando…</p>';
    try{var r=await aFetch('/api/account');A.cuenta=await r.json()}catch(e){el.innerHTML='<p class="note">No pudimos cargar tu cuenta.</p>';return}
  }
  var c=A.cuenta,E={activo:'Al día',vencido:'Vencida',suspendido:'Suspendido'};
  var h='<div class="sh" style="margin-top:22px"><h2>Cuenta</h2><p>Tu plan, los datos de acceso y ayuda de Minuta.</p></div><div class="box rise"><h4 role="heading" aria-level="3">Tu plan Minuta</h4><p><span class="badge'+(c.estado==='activo'?' ok':' bad')+'">'+esc(E[c.estado]||c.estado)+'</span> '+(c.venceEl?'<span class="mono">Vence el '+esc(fechaTxt(c.venceEl))+'</span>':'')+'</p><p class="note">Usuario: '+esc(c.email)+'</p>'+
  '<div class="acts"><a class="btn wa" target="_blank" rel="noopener" href="'+esc(MI_WA_URL('Hola! Soy de '+S.cfg.nombre+' y necesito ayuda con Minuta.'))+'">'+ico('wa')+'Soporte: +54 11 5249-5689</a></div></div>';
  h+='<div class="box"><h4 role="heading" aria-level="3">Cambiar contraseña</h4><label class="f" for="pwA">Contraseña actual<input id="pwA" type="password" autocomplete="current-password"></label>'+
  '<label class="f" for="pwN">Contraseña nueva (mínimo 8 caracteres)<input id="pwN" type="password" autocomplete="new-password"></label><div class="acts"><button class="btn" id="pwGuardar">Cambiar contraseña</button></div>'+
  '<p class="note" id="cuMsg" role="status"></p></div>';
  h+='<p class="lnk"><a href="/terminos" target="_blank" rel="noopener">Términos del servicio</a><a href="/privacidad" target="_blank" rel="noopener">Privacidad</a><a href="/arrepentimiento" target="_blank" rel="noopener">Botón de baja</a></p>';
  el.innerHTML=h;
}
$('#t-cuenta').addEventListener('click',async function(e){
  if(e.target.id!=='pwGuardar')return;
  var msg=function(m){var x=$('#cuMsg');if(x)x.textContent=m};
  try{
    var r=await aFetch('/api/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accion:'clave',actual:$('#pwA').value,nueva:$('#pwN').value})});
    var j=await r.json().catch(function(){return null});
    if(!r.ok){msg((j&&j.mensaje)||'No pudimos cambiarla.');return}
    A.tok=j.token;store.set('tok',j.token);$('#pwA').value='';$('#pwN').value='';msg('Contraseña cambiada.');toast('Contraseña cambiada.');
  }catch(err){msg('No pudimos conectar. Probá de nuevo.')}
});


function adminInit(){
  $('#tienda').hidden=true;$('#admin').hidden=false;document.title='Panel del local · Minuta';
  $('#aOlvide').href=MI_WA_URL('Hola! Me olvidé la contraseña del panel de mi local.');
  var t0=store.get('tok');if(t0){A.tok=t0;aEnter()}
}
