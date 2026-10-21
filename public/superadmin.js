'use strict';
var MI_WA='5491152495689';
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var ico=function(n){return '<svg class="ico" aria-hidden="true"><use href="#i-'+n+'"/></svg>'};
var money=function(n){return '$ '+Number(n||0).toLocaleString('es-AR')};
var pw='',DATA=null,V='resumen',FILTRO='todos',Q='',ultimaCred=null,aprobados={};
var st={get:function(k){try{return sessionStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{sessionStorage.setItem(k,v)}catch(e){}},del:function(k){try{sessionStorage.removeItem(k)}catch(e){}}};

async function api(body,path){
  var r=await fetch(path||'/api/superadmin',{method:body?'POST':'GET',headers:{'x-super-password':encodeURIComponent(pw),'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
  var j=await r.json().catch(function(){return null});
  return {ok:r.ok,status:r.status,j:j||{}};
}
function fecha(iso){if(!iso)return 'sin fecha';var p=iso.slice(0,10).split('-');return p[2]+'/'+p[1]+'/'+p[0]}
function dias(iso){if(!iso||!DATA)return null;return Math.round((Date.parse(iso+'T12:00:00Z')-Date.parse(DATA.hoy+'T12:00:00Z'))/86400000)}
function estadoDe(l){if(l.estado==='activo'){var d=dias(l.venceEl);if(d!==null&&d<=7)return 'pronto'}return l.estado}
var ETXT={activo:'Al día',pronto:'Por vencer',vencido:'Vencido',suspendido:'Suspendido'};
function waAr(t){var d=String(t||'').replace(/\D/g,'').replace(/^0/,'');if(!d)return '';if(d.indexOf('54')===0)return d;if(d.length>10)for(var i=2;i<=4;i++){if(d.substr(i,2)==='15'&&d.length-2===10){d=d.slice(0,i)+d.slice(i+2);break}}return '549'+d}
function waLink(num,txt){var n=waAr(num);return n?'https://wa.me/'+n+'?text='+encodeURIComponent(txt):''}
function panelUrl(u){return u.indexOf('?local=')>-1?u.replace('/?local=','/admin?local='):u+'/admin'}
function credMsg(c){return '¡Hola! Tu menú online de Minuta ya está listo.\n\nTu tienda: '+c.url+'\nTu panel: '+panelUrl(c.url)+'\nUsuario: '+c.email+'\nContraseña: '+c.password+'\n\nEntrá al panel, subí tu logo y las fotos de tus platos, y cargá tu menú. Cualquier duda, escribime a este número.'}
var tT=null;
function toast(m,k){var t=$('.toast');if(!t){t=document.createElement('div');t.setAttribute('role','status');document.body.appendChild(t)}t.className='toast '+(k||'ok');t.textContent=m;t.hidden=false;t.style.animation='none';void t.offsetWidth;t.style.animation='';clearTimeout(tT);tT=setTimeout(function(){t.hidden=true},3000)}
async function copiar(txt,btn){try{await navigator.clipboard.writeText(txt);toast('Copiado.');if(btn){var o=btn.innerHTML;btn.textContent='¡Copiado!';setTimeout(function(){btn.innerHTML=o},1500)}}catch(e){toast('No se pudo copiar. Seleccionalo a mano.','bad')}}

/* Confirmación con modal (en vez de "tocá de nuevo") */
function confirmar(o){
  return new Promise(function(res){
    var d=$('#dConf');$('#cTit').textContent=o.tit;$('#cTxt').textContent=o.txt||'';$('#cErr').textContent='';
    $('#cExtra').innerHTML=o.escribir?'<label class="f">Escribí <b class="mono">'+esc(o.escribir)+'</b> para confirmar<input id="cInp" autocomplete="off"></label>':'';
    var si=$('#cSi');si.textContent=o.si||'Confirmar';si.className='btn'+(o.peligro?' danger':'');
    var fin=function(v){d.close();si.onclick=null;$('#cNo').onclick=null;res(v)};
    si.onclick=function(){if(o.escribir&&($('#cInp').value.trim()!==o.escribir)){$('#cErr').textContent='No coincide.';return}fin(o.escribir?$('#cInp').value.trim():true)};
    $('#cNo').onclick=function(){fin(false)};d.oncancel=function(){res(false)};
    d.showModal();var ci=$('#cInp');if(ci)ci.focus();
  });
}

/* ---------- Entrar ---------- */
async function entrar(){
  pw=$('#sp').value||st.get('sp')||'';
  if(!pw){$('#lerr').textContent='Escribí la contraseña.';return}
  $('#lgo').disabled=true;$('#lgo').textContent='Entrando…';
  var r=await api().catch(function(){return {ok:false,j:{mensaje:'No pudimos conectar.'}}});
  $('#lgo').disabled=false;$('#lgo').textContent='Entrar';
  if(!r.ok){$('#lerr').textContent=r.j.mensaje||'Contraseña incorrecta.';st.del('sp');return}
  st.set('sp',pw);$('#sp').value='';
  $('#login').hidden=true;$('#app').hidden=false;
  DATA=r.j;ir(location.hash.slice(1)||'resumen');
}
async function recargar(silencio){var r=await api();if(r.ok){DATA=r.j;pintar();if(!silencio)toast('Actualizado.')}}

/* ---------- Navegación ---------- */
var VISTAS={
  resumen:['Resumen','Lo que pasa hoy con tus locales.'],
  locales:['Locales','Tocá un local para ver todo y cobrarle.'],
  solicitudes:['Solicitudes','Locales que se anotaron y trámites de baja o arrepentimiento.'],
  nuevo:['Nuevo local','Creás el local y le pasás el usuario por WhatsApp.'],
  pagina:['Página de inicio','Lo que ven los negocios en /inicio: textos, precio, fotos y datos legales.'],
  registro:['Registro','Errores del servidor y operaciones sensibles (contraseñas, pagos, suspensiones, borrados).']
};
function ir(v){
  if(!VISTAS[v])v='resumen';V=v;
  try{history.replaceState(null,'','#'+v)}catch(e){}
  $$('.nav[data-v]').forEach(function(b){if(b.getAttribute('data-v')===v)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  pintar();window.scrollTo(0,0);
}
$$('.nav[data-v]').forEach(function(b){b.addEventListener('click',function(){ir(b.getAttribute('data-v'))})});
['#salir','#salir2'].forEach(function(id){$(id).addEventListener('click',function(){st.del('sp');location.hash='';location.reload()})});
window.addEventListener('hashchange',function(){if(DATA){var v=location.hash.slice(1);if(v&&v!==V)ir(v)}});

function pintar(){
  if(!DATA)return;
  var L=DATA.locales,nuevas=(DATA.solicitudes||[]).filter(function(x){return x.estado==='nueva'}).length,tram=(DATA.tramites||[]).filter(function(x){return x.estado==='pendiente'}).length;
  var alerta=L.filter(function(l){var e=estadoDe(l);return e==='vencido'||e==='pronto'}).length;
  $('#nSol').hidden=!(nuevas+tram);$('#nSol').textContent=nuevas+tram;
  $('#nLoc').hidden=!alerta;$('#nLoc').textContent=alerta;
  $('#vTit').textContent=VISTAS[V][0];$('#vSub').textContent=VISTAS[V][1];
  $('#vActs').innerHTML='<button class="btn sm ghost" id="refresh">'+ico('refresh')+'Actualizar</button>';
  $('#refresh').onclick=function(){recargar()};
  var h=({resumen:vResumen,locales:vLocales,solicitudes:vSolicitudes,nuevo:vNuevo,pagina:vPagina,registro:vRegistro})[V]();
  var el=$('#view');el.innerHTML='<div class="view">'+h+'</div>';
  if(V==='pagina')cargarPlan();
  if(V==='registro')cargarRegistro();
  if(V==='resumen')animarNumeros();
}
function animarNumeros(){
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  $$('[data-count]').forEach(function(el){
    var fin=+el.getAttribute('data-count'),pre=el.getAttribute('data-pre')||'',t0=performance.now();
    (function paso(t){var k=Math.min(1,(t-t0)/600),v=Math.round(fin*(1-Math.pow(1-k,3)));el.textContent=pre?money(v):v;if(k<1)requestAnimationFrame(paso)})(t0);
  });
}

/* ---------- Registro ---------- */
function vRegistro(){return '<div id="regBox"><div class="card"><p class="mute">Cargando…</p></div></div>'}
async function cargarRegistro(){
  var r=await api(null,'/api/superadmin?registro=1');
  var box=$('#regBox');if(!box)return;
  if(!r.ok){box.innerHTML='<div class="card"><p class="err">No pudimos cargar el registro.</p></div>';return}
  var cuando=function(t){var d=new Date(t);return d.toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})};
  var ER=r.j.errores||[],AU=r.j.auditoria||[];
  var h='<div class="card"><h3>Errores del servidor <span class="mute">('+ER.length+')</span></h3>'+(ER.length?ER.map(function(e){
    return '<div style="padding:10px 0;border-top:1px solid var(--line)"><b>'+esc(e.msg)+'</b><div class="mute" style="font-size:13px">'+esc(cuando(e.t))+' · '+esc(e.metodo)+' '+esc(e.ruta)+' · '+esc(e.host)+'</div><div class="mono mute" style="font-size:12px;word-break:break-word">'+esc(e.pila)+'</div></div>'}).join(''):'<p class="mute">Sin errores registrados.</p>')+'</div>';
  h+='<div class="card" style="margin-top:14px"><h3>Operaciones sensibles <span class="mute">('+AU.length+')</span></h3>'+(AU.length?AU.map(function(a){
    return '<div style="padding:10px 0;border-top:1px solid var(--line)"><b>'+esc(a.accion.replace(/_/g,' '))+'</b> · '+esc(a.slug||'—')+'<div class="mute" style="font-size:13px">'+esc(cuando(a.t))+' · '+esc(a.quien)+(a.detalle?' · '+esc(a.detalle):'')+'</div></div>'}).join(''):'<p class="mute">Todavía no hay operaciones.</p>')+'</div>';
  box.innerHTML=h;
}

/* ---------- Resumen ---------- */
function vResumen(){
  var L=DATA.locales,c={activo:0,pronto:0,vencido:0,suspendido:0};
  L.forEach(function(l){c[estadoDe(l)]++});
  var ingreso=L.filter(function(l){return l.estado==='activo'}).reduce(function(s,l){return s+(l.cuota||0)},0);
  var pedidos=L.reduce(function(s,l){return s+(l.pedidos||0)},0);
  var nuevas=(DATA.solicitudes||[]).filter(function(x){return x.estado==='nueva'});
  var tram=(DATA.tramites||[]).filter(function(x){return x.estado==='pendiente'});
  var h='';
  if(!DATA.rootDomain)h+='<div class="mini-help" style="margin-bottom:14px"><b>Falta definir ROOT_DOMAIN en Vercel.</b> Sin eso los locales no tienen su subdominio (tulocal.minuta.com.ar).</div>';
  h+='<div class="grid g4">'+
    '<div class="card kpi dark"><span class="cap">Locales al día</span><b data-count="'+(c.activo+c.pronto)+'">'+(c.activo+c.pronto)+'</b><small>de '+L.length+' en total</small><button aria-label="Ver locales al día" data-go="locales" data-f="activo"></button></div>'+
    '<div class="card kpi'+(c.pronto?' warn':'')+'"><span class="cap">Vencen en 7 días</span><b data-count="'+c.pronto+'">'+c.pronto+'</b><small>avisales antes</small><button aria-label="Ver por vencer" data-go="locales" data-f="pronto"></button></div>'+
    '<div class="card kpi"><span class="cap">Vencidos</span><b data-count="'+c.vencido+'" style="color:var(--error)">'+c.vencido+'</b><small>no toman pedidos</small><button aria-label="Ver vencidos" data-go="locales" data-f="vencido"></button></div>'+
    '<div class="card kpi"><span class="cap">Ingreso mensual</span><b data-count="'+ingreso+'" data-pre="$">'+money(ingreso)+'</b><small>suma de cuotas activas</small></div>'+
  '</div>';
  var todo=L.filter(function(l){var e=estadoDe(l);return e==='vencido'||e==='pronto'}).sort(function(a,b){return (a.venceEl||'').localeCompare(b.venceEl||'')});
  h+='<div class="grid g2" style="margin-top:14px"><div class="card"><h3>Para cobrar</h3>';
  h+=todo.length?'<div class="todo">'+todo.map(function(l){
    var d=dias(l.venceEl),txt=d<0?'venció hace '+(-d)+' día'+(d===-1?'':'s'):d===0?'vence hoy':'vence en '+d+' día'+(d===1?'':'s');
    var wa=waLink(l.whatsapp,'¡Hola! Te escribo de Minuta: la mensualidad de '+l.nombre+' '+(d<0?'está vencida':'vence el '+fecha(l.venceEl))+'. ¿Te paso los datos para pagarla?');
    return '<div class="it"><div><b>'+esc(l.nombre)+'</b><span class="mute" style="font-size:13px">'+txt+(l.cuota?' · '+money(l.cuota):'')+'</span></div><div class="row">'+(wa?'<a class="btn sm wa" target="_blank" rel="noopener" href="'+esc(wa)+'">'+ico('wa')+'Recordar</a>':'')+'<button class="btn sm" data-pago="'+esc(l.slug)+'">'+ico('cash')+'Cobró 1 mes</button></div></div>';
  }).join('')+'</div>':'<div class="empty">Nadie vence esta semana. Todo al día.</div>';
  h+='</div><div class="card"><h3>Bandeja</h3><div class="todo">';
  h+='<div class="it"><div><b>'+nuevas.length+' solicitud'+(nuevas.length===1?'':'es')+' nueva'+(nuevas.length===1?'':'s')+'</b><span class="mute" style="font-size:13px">Locales que quieren Minuta</span></div><button class="btn sm ghost" data-go="solicitudes">Ver</button></div>';
  h+='<div class="it"><div><b>'+tram.length+' trámite'+(tram.length===1?'':'s')+' pendiente'+(tram.length===1?'':'s')+'</b><span class="mute" style="font-size:13px">Bajas y arrepentimientos: respondé en 24 h</span></div><button class="btn sm ghost" data-go="solicitudes">Ver</button></div>';
  h+='<div class="it"><div><b class="mono">'+pedidos.toLocaleString('es-AR')+'</b><span class="mute" style="font-size:13px">pedidos tomados por todos tus locales</span></div></div>';
  h+='</div><div class="acts"><button class="btn" data-go="nuevo">'+ico('plus')+'Crear un local</button><a class="btn ghost" href="/inicio" target="_blank" rel="noopener">'+ico('ext')+'Ver mi página</a></div></div></div>';
  return h;
}

/* ---------- Locales ---------- */
function vLocales(){
  var L=DATA.locales,c={todos:L.length,activo:0,pronto:0,vencido:0,suspendido:0};
  L.forEach(function(l){c[estadoDe(l)]++});
  var h='<div class="toolbar"><input type="search" id="buscar" placeholder="Buscar por nombre, dirección, email o WhatsApp" value="'+esc(Q)+'" aria-label="Buscar locales"><div class="chips" id="fil">'+
    [['todos','Todos'],['activo','Al día'],['pronto','Por vencer'],['vencido','Vencidos'],['suspendido','Suspendidos']].map(function(f){return '<button data-fil="'+f[0]+'" aria-pressed="'+(FILTRO===f[0])+'">'+f[1]+'<span class="c">'+c[f[0]]+'</span></button>'}).join('')+'</div></div>';
  h+='<div id="lista" class="grid g3">'+listaLocales()+'</div>';
  return h;
}
function listaLocales(){
  var q=Q.trim().toLowerCase();
  var L=DATA.locales.filter(function(l){return (FILTRO==='todos'||estadoDe(l)===FILTRO)&&(!q||[l.nombre,l.slug,l.email,l.whatsapp,l.contacto].join(' ').toLowerCase().indexOf(q)>-1)})
    .sort(function(a,b){return a.nombre.localeCompare(b.nombre)});
  if(!L.length)return '<div class="empty" style="grid-column:1/-1">'+(DATA.locales.length?'Ningún local coincide con la búsqueda.':'Todavía no cargaste ningún local. <button class="btn sm" data-go="nuevo" style="margin-left:6px">Crear el primero</button>')+'</div>';
  return L.map(function(l){
    var e=estadoDe(l);
    return '<div class="card lift loc e-'+e+'" data-s="'+esc(l.slug)+'" role="button" tabindex="0"><div class="t"><b>'+esc(l.nombre)+'</b><span class="badge b-'+e+'">'+ETXT[e]+'</span></div>'+
      '<div class="u">'+esc(l.url?l.url.replace('https://',''):l.slug)+'</div>'+
      '<div class="m"><span>Vence <b>'+esc(fecha(l.venceEl))+'</b></span><span>Pedidos <b>'+(l.pedidos||0)+'</b></span>'+(l.cuota?'<span>Cuota <b>'+money(l.cuota)+'</b></span>':'')+'</div></div>';
  }).join('');
}

/* Ficha del local (drawer) */
function abrirLocal(slug){
  var l=DATA.locales.filter(function(x){return x.slug===slug})[0];if(!l)return;
  var e=estadoDe(l),d=$('#dLoc'),cred=ultimaCred&&ultimaCred.slug===slug?ultimaCred:null;
  var h='<div class="dh"><div><small>'+esc(l.slug)+'</small><h2>'+esc(l.nombre)+'</h2></div><button class="x" data-cerrar aria-label="Cerrar">'+ico('x')+'</button></div><div class="db">';
  h+='<div class="row"><span class="badge b-'+e+'">'+ETXT[e]+'</span><span class="mute">Vence el <b class="mono">'+esc(fecha(l.venceEl))+'</b></span>'+(l.url?'<a class="btn sm ghost" target="_blank" rel="noopener" href="'+esc(l.url)+'">'+ico('ext')+'Tienda</a><a class="btn sm ghost" target="_blank" rel="noopener" href="'+esc(panelUrl(l.url))+'">'+ico('ext')+'Panel</a>':'')+'</div>';
  if(cred)h+='<div class="cred"><b>Contraseña nueva</b> (se muestra una sola vez)<div class="pw">'+esc(cred.password)+'</div><div class="acts"><button class="btn sm ghost" data-copy="cred">'+ico('copy')+'Copiar mensaje</button>'+(waLink(l.whatsapp,'x')?'<a class="btn sm wa" target="_blank" rel="noopener" href="'+esc(waLink(l.whatsapp,credMsg(cred)))+'">'+ico('wa')+'Mandar por WhatsApp</a>':'')+'</div></div>';
  // Mensualidad
  h+='<div class="card"><h3>'+ico('cash')+'Mensualidad</h3><div class="row"><label class="f" style="flex:1 1 140px;margin:0">Meses<select id="dMeses"><option value="1">1 mes</option><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option></select></label>'+
    '<label class="f" style="flex:1 1 140px;margin:0">Monto cobrado ($)<input id="dMonto" inputmode="numeric" placeholder="'+(l.cuota||'')+'"></label></div>'+
    '<div class="acts"><button class="btn ok" data-acc="pago">Registrar pago</button></div>'+
    '<div class="row" style="margin-top:12px;align-items:end"><label class="f" style="flex:1;margin:0">Cambiar vencimiento a mano<input type="date" id="dVence" value="'+esc(l.venceEl||'')+'"></label><button class="btn ghost" data-acc="vence">Cambiar</button></div>';
  h+=(l.pagos&&l.pagos.length)?'<table class="hist"><tr><th>Fecha</th><th>Meses</th><th>Hasta</th><th style="text-align:right">Monto</th></tr>'+l.pagos.map(function(p){return '<tr><td class="mono">'+fecha(p.fecha)+'</td><td>'+p.meses+'</td><td class="mono">'+fecha(p.hasta)+'</td><td class="n">'+(p.monto?money(p.monto):'—')+'</td></tr>'}).join('')+'</table>':'<p class="mute" style="font-size:13px;margin:10px 0 0">Todavía no hay pagos registrados.</p>';
  h+='</div>';
  // Datos
  h+='<div class="card"><h3>Datos del local</h3>'+
    '<label class="f">Nombre<input id="dNom" maxlength="40" value="'+esc(l.nombre)+'"></label>'+
    '<div class="grid g2" style="gap:10px"><label class="f">Email del dueño (usuario)<input id="dMail" type="email" value="'+esc(l.email)+'"></label><label class="f">WhatsApp del dueño<input id="dWa" inputmode="tel" value="'+esc(l.whatsapp)+'" placeholder="11 5555-1234"></label></div>'+
    '<div class="grid g2" style="gap:10px"><label class="f">Persona de contacto<input id="dCont" maxlength="60" value="'+esc(l.contacto)+'"></label><label class="f">Cuota mensual ($)<input id="dCuota" inputmode="numeric" value="'+esc(l.cuota||'')+'" placeholder="25000"></label></div>'+
    '<label class="f">Notas internas<textarea id="dNotas" rows="2" maxlength="200">'+esc(l.notas)+'</textarea></label>'+
    '<div class="acts"><button class="btn" data-acc="datos">Guardar datos</button>'+(waLink(l.whatsapp,'x')?'<a class="btn ghost" target="_blank" rel="noopener" href="'+esc(waLink(l.whatsapp,'¡Hola! Te escribo de Minuta por '+l.nombre+'.'))+'">'+ico('wa')+'Escribirle</a>':'')+'</div></div>';
  // Acceso y peligro
  h+='<div class="card"><h3>'+ico('key')+'Acceso</h3><p class="mute" style="margin:0">Si el dueño se olvidó la contraseña, generá una nueva. Se cierran sus sesiones abiertas.</p><div class="acts"><button class="btn ghost" data-acc="clave">Generar contraseña nueva</button></div></div>';
  h+='<div class="card" style="border-color:var(--error)"><h3>Zona delicada</h3><div class="acts" style="margin-top:0"><button class="btn '+(l.activo?'ghost':'ok')+'" data-acc="toggle">'+(l.activo?'Suspender local':'Reactivar local')+'</button><button class="btn danger" data-acc="borrar">Borrar local</button></div><p class="mute" style="font-size:13px;margin:10px 0 0">Creado el '+esc(fecha(l.creado))+'.</p></div>';
  h+='<p class="err" id="dErr"></p></div>';
  d.innerHTML=h;d.setAttribute('data-s',slug);
  if(!d.open)d.showModal();
}
$('#dLoc').addEventListener('click',async function(e){
  if(e.target===this){this.close();return}
  var b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-cerrar')){this.close();return}
  var slug=this.getAttribute('data-s'),l=DATA.locales.filter(function(x){return x.slug===slug})[0];
  if(b.getAttribute('data-copy')==='cred'){copiar(credMsg(ultimaCred),b);return}
  var a=b.getAttribute('data-acc');if(!a)return;
  var req,okTxt;
  if(a==='pago'){var mo=parseInt(($('#dMonto').value||'').replace(/\D/g,''),10);req={accion:'pago',slug:slug,meses:+$('#dMeses').value};if(mo)req.monto=mo;okTxt='Pago registrado.'}
  else if(a==='vence'){req={accion:'editar',slug:slug,venceEl:$('#dVence').value};okTxt='Vencimiento cambiado.'}
  else if(a==='datos'){req={accion:'editar',slug:slug,nombre:$('#dNom').value,email:$('#dMail').value,whatsapp:$('#dWa').value,contacto:$('#dCont').value,cuota:parseInt(($('#dCuota').value||'0').replace(/\D/g,''),10)||0,notas:$('#dNotas').value};okTxt='Datos guardados.'}
  else if(a==='toggle'){
    if(l.activo&&!(await confirmar({tit:'¿Suspender '+l.nombre+'?',txt:'Su tienda deja de tomar pedidos hasta que lo reactives. El dueño puede seguir entrando a su panel.',si:'Suspender',peligro:true})))return;
    req={accion:'editar',slug:slug,activo:!l.activo};okTxt=l.activo?'Local suspendido.':'Local reactivado.';
  }
  else if(a==='clave'){
    if(!(await confirmar({tit:'¿Contraseña nueva?',txt:'Se cierra la sesión del dueño en todos sus dispositivos.',si:'Generar'})))return;
    req={accion:'clave',slug:slug};okTxt='Contraseña generada.';
  }
  else if(a==='borrar'){
    var conf=await confirmar({tit:'Borrar '+l.nombre,txt:'Se borran su menú, sus fotos y su usuario. No se puede deshacer.',escribir:slug,si:'Borrar para siempre',peligro:true});
    if(!conf)return;req={accion:'borrar',slug:slug,confirmar:conf};okTxt='Local borrado.';
  }
  b.disabled=true;
  var r=await api(req);
  b.disabled=false;
  if(!r.ok){$('#dErr').textContent=r.j.mensaje||'No se pudo.';toast(r.j.mensaje||'No se pudo.','bad');return}
  if(a==='clave')ultimaCred={slug:slug,url:r.j.local.url||slug,email:r.j.local.email,password:r.j.password};
  toast(okTxt);
  await recargar(true);
  if(a==='borrar')this.close();else abrirLocal(slug);
});

/* ---------- Solicitudes ---------- */
function slugDe(t){return String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)}
function vSolicitudes(){
  var S=(DATA.solicitudes||[]).filter(function(x){return x.estado==='nueva'}),T=DATA.tramites||[];
  var h='';
  Object.keys(aprobados).forEach(function(id){var a=aprobados[id];
    h+='<div class="cred" style="margin:0 0 14px"><b>'+esc(a.nombre)+' · aprobada</b><p class="mute">Pasale estos datos. La contraseña se muestra una sola vez.</p><p>Tienda: <b class="mono">'+esc(a.url)+'</b><br>Usuario: <b>'+esc(a.email)+'</b></p><div class="pw">'+esc(a.password)+'</div><div class="acts"><button class="btn sm ghost" data-sa="copiar" data-id="'+esc(id)+'">'+ico('copy')+'Copiar mensaje</button>'+(a.wa?'<a class="btn sm wa" target="_blank" rel="noopener" href="'+esc(waLink(a.wa,credMsg(a)))+'">'+ico('wa')+'Mandar por WhatsApp</a>':'')+'<button class="btn sm ghost" data-sa="listo" data-id="'+esc(id)+'">Listo</button></div></div>';
  });
  h+='<h2 class="cap" style="margin:0 0 10px">Solicitudes nuevas · '+S.length+'</h2>';
  h+=S.length?'<div class="grid g2">'+S.map(function(x){
    return '<div class="card" data-id="'+esc(x.id)+'"><div class="row" style="justify-content:space-between"><b style="font-size:16px">'+esc(x.nombre)+'</b><span class="mute mono" style="font-size:12px">'+esc(fecha(x.creado))+'</span></div>'+
    '<p class="mute" style="margin:6px 0">'+esc(x.email)+' · WA '+esc(x.whatsapp)+(x.zona?' · '+esc(x.zona):'')+(x.rubro?' · '+esc(x.rubro):'')+'</p>'+(x.mensaje?'<p style="margin:6px 0">“'+esc(x.mensaje)+'”</p>':'')+
    '<div class="grid g2" style="gap:10px"><label class="f" style="margin:0">Dirección<input data-f="slug" value="'+esc(slugDe(x.nombre))+'" maxlength="30"></label><label class="f" style="margin:0">Vence el<input type="date" data-f="vence"></label></div>'+
    '<div class="acts"><button class="btn ok" data-sa="aprobar">Aprobar y crear</button><a class="btn ghost" target="_blank" rel="noopener" href="'+esc(waLink(x.whatsapp,'¡Hola! Te escribo de Minuta por la solicitud de '+x.nombre+'.'))+'">'+ico('wa')+'Escribirle</a><button class="btn danger" data-sa="descartar">Descartar</button></div><p class="err" data-e></p></div>';
  }).join('')+'</div>':'<div class="empty">No hay solicitudes nuevas. Cuando alguien complete el formulario de tu página, aparece acá.</div>';
  h+='<h2 class="cap" style="margin:26px 0 10px">Botón de baja y de arrepentimiento · '+T.filter(function(t){return t.estado==='pendiente'}).length+' pendientes</h2>';
  h+='<p class="mute" style="margin:-4px 0 12px;font-size:14px">La ley te pide confirmar el trámite dentro de las 24 horas. El código ya se lo mostramos a la persona.</p>';
  h+=T.length?'<div class="grid g2">'+T.map(function(t){
    return '<div class="card"><div class="row" style="justify-content:space-between"><b class="mono">'+esc(t.codigo)+'</b><span class="badge '+(t.estado==='pendiente'?'b-pronto':'b-activo')+'">'+(t.estado==='pendiente'?'Pendiente':'Resuelto')+'</span></div>'+
    '<p style="margin:6px 0"><b>'+(t.tipo==='baja'?'Baja del servicio':'Arrepentimiento')+'</b> · '+esc(t.nombre)+(t.local?' ('+esc(t.local)+')':'')+'</p><p class="mute" style="margin:0;font-size:13px">'+esc(t.email)+(t.whatsapp?' · WA '+esc(t.whatsapp):'')+' · '+esc(fecha(t.creado))+'</p>'+(t.detalle?'<p style="margin:6px 0">“'+esc(t.detalle)+'”</p>':'')+
    '<div class="acts"><a class="btn sm ghost" href="mailto:'+esc(t.email)+'?subject='+encodeURIComponent('Tu trámite '+t.codigo+' en Minuta')+'">Responder por email</a>'+(t.whatsapp?'<a class="btn sm wa" target="_blank" rel="noopener" href="'+esc(waLink(t.whatsapp,'Hola '+t.nombre+', te escribo de Minuta por tu trámite '+t.codigo+'.'))+'">'+ico('wa')+'WhatsApp</a>':'')+'<button class="btn sm '+(t.estado==='pendiente'?'ok':'ghost')+'" data-tram="'+esc(t.id)+'" data-est="'+(t.estado==='pendiente'?'resuelto':'pendiente')+'">'+(t.estado==='pendiente'?'Marcar resuelto':'Volver a pendiente')+'</button></div></div>';
  }).join('')+'</div>':'<div class="empty">No hay trámites. Está bien así.</div>';
  return h;
}

/* ---------- Nuevo local ---------- */
function vNuevo(){
  var h='<div class="grid g2"><div class="card"><div class="steps3"><span class="on"></span><span class="'+(ultimaCred&&ultimaCred.nuevo?'on':'')+'"></span></div>'+
  '<label class="f">Nombre del local<input id="nNom" maxlength="40" placeholder="Bodegón Don Luis"></label>'+
  '<label class="f">Dirección web<input id="nSlug" maxlength="30" placeholder="don-luis"><small class="help" id="nUrlHelp">Su tienda queda en don-luis.'+esc(DATA.rootDomain||'tudominio.com')+'</small></label>'+
  '<div class="grid g2" style="gap:10px"><label class="f">Email del dueño (su usuario)<input id="nMail" type="email"></label><label class="f">WhatsApp del dueño<input id="nWa" inputmode="tel" placeholder="11 5555-1234"></label></div>'+
  '<label class="f">Vence el<input id="nVence" type="date"><small class="help">Vacío = sin vencimiento. Después lo manejás con “Registrar pago”.</small></label>'+
  '<p class="err" id="nerr" role="alert"></p><div class="acts"><button class="btn" id="nGo">'+ico('plus')+'Crear local</button></div></div>';
  h+='<div>';
  if(ultimaCred&&ultimaCred.nuevo){var c=ultimaCred;
    h+='<div class="cred" style="margin-top:0"><b>¡Listo! '+esc(c.nombre)+' ya existe.</b><p class="mute">Pasale estos datos. La contraseña se muestra una sola vez.</p><p>Tienda: <b class="mono">'+esc(c.url)+'</b><br>Panel: <b class="mono">'+esc(panelUrl(c.url))+'</b><br>Usuario: <b>'+esc(c.email)+'</b></p><div class="pw">'+esc(c.password)+'</div><div class="acts"><button class="btn sm ghost" id="nCopy">'+ico('copy')+'Copiar mensaje</button>'+(c.wa?'<a class="btn sm wa" target="_blank" rel="noopener" href="'+esc(waLink(c.wa,credMsg(c)))+'">'+ico('wa')+'Mandar por WhatsApp</a>':'')+'</div></div>';
  }else h+='<div class="mini-help"><b>Cómo sigue</b><ol style="margin:8px 0 0;padding-left:18px"><li>Creás el local acá.</li><li>Le mandás el usuario y la contraseña por WhatsApp con un toque.</li><li>El dueño entra a su panel, sube logo, fotos y menú, y abre los pedidos.</li></ol></div>';
  h+='</div></div>';
  return h;
}

/* ---------- Página de inicio ---------- */
var PLAN=null;
function fotoSite(id,v){return '/api/foto?site=1&id='+encodeURIComponent(id)+'&v='+encodeURIComponent(v)}
function vPagina(){
  return '<div class="grid g2" id="pg"><div class="sk"></div><div class="sk"></div></div>';
}
function cargarPlan(){
  PLAN=JSON.parse(JSON.stringify(DATA.plan));
  var p=PLAN,L=p.legal||{};
  var h='<div class="card"><h3>Textos y precio</h3>'+
  '<div class="grid g2" style="gap:10px"><label class="f">Nombre de la marca<input id="pMarca" maxlength="40" value="'+esc(p.marca)+'"></label><label class="f">Instagram (sin @)<input id="pIg" maxlength="40" value="'+esc(p.instagram)+'"></label></div>'+
  '<label class="f">Título principal<input id="pTitulo" maxlength="90" value="'+esc(p.titulo)+'"></label>'+
  '<label class="f">Bajada<textarea id="pBajada" rows="2" maxlength="200">'+esc(p.bajada)+'</textarea></label>'+
  '<div class="grid g2" style="gap:10px"><label class="f">Precio mensual<input id="pPrecio" maxlength="30" placeholder="$25.000" value="'+esc(p.precio)+'"><small class="help">Vacío = “Consultá el precio”.</small></label><label class="f">Período<input id="pPeriodo" maxlength="20" value="'+esc(p.periodo)+'"></label></div>'+
  '<label class="f">Costo de alta<input id="pAlta" maxlength="80" placeholder="Alta sin cargo" value="'+esc(p.alta)+'"></label>'+
  '<div class="grid g2" style="gap:10px"><label class="f">Tu WhatsApp<input id="pWa" maxlength="20" value="'+esc(p.whatsapp)+'"><small class="help">+54 11 5249-5689 = 5491152495689</small></label><label class="f">Email de contacto<input id="pMail" type="email" maxlength="120" value="'+esc(p.email)+'"></label></div>'+
  '<label class="f">Qué incluye (una línea por punto)<textarea id="pInc" rows="7">'+esc(p.incluye.join('\n'))+'</textarea></label></div>';
  h+='<div style="display:grid;gap:14px;align-content:start"><div class="card"><h3>Imagen principal</h3>'+(p.hero?'<img class="hero-prev" alt="" src="'+esc(fotoSite('hero',p.hero))+'">':'<div class="ph0">Sin imagen: se muestra el ticket de ejemplo</div>')+
  '<div class="acts"><label class="btn ghost" style="cursor:pointer">'+ico('plus')+(p.hero?'Cambiar':'Subir imagen')+'<input type="file" id="heroFile" accept="image/*" hidden></label>'+(p.hero?'<button class="btn ghost" data-pg="nohero">Quitar</button>':'')+'</div></div>'+
  '<div class="card"><h3>Galería: locales que ya usan Minuta</h3><p class="mute" style="margin:0;font-size:14px">Hasta 8 fotos (platos, capturas de menús, locales). Se ven en tu página.</p><div class="imgs">'+
  (p.galeria||[]).map(function(g,i){return '<div class="im"><img alt="" src="'+esc(fotoSite(g.id,g.v))+'"><div><input data-gt="'+i+'" maxlength="60" placeholder="Título (opcional)" value="'+esc(g.titulo)+'"><button class="btn sm danger" data-pg="gdel" data-i="'+i+'">Quitar</button></div></div>'}).join('')+'</div>'+
  ((p.galeria||[]).length<8?'<div class="acts"><label class="btn ghost" style="cursor:pointer">'+ico('plus')+'Agregar foto<input type="file" id="galFile" accept="image/*" hidden></label></div>':'')+'</div>'+
  '<div class="card"><h3>Datos legales del titular</h3><p class="mute" style="margin:0 0 4px;font-size:14px">Aparecen en el pie, los términos y la privacidad. La ley pide identificar al proveedor.</p>'+
  '<label class="f">Nombre o razón social<input id="lTit" maxlength="80" value="'+esc(L.titular)+'"></label><div class="grid g2" style="gap:10px"><label class="f">CUIT<input id="lCuit" maxlength="13" placeholder="20-12345678-9" value="'+esc(L.cuit)+'"></label><label class="f">Email legal<input id="lMail" type="email" maxlength="120" value="'+esc(L.email)+'"></label></div><label class="f">Domicilio<input id="lDom" maxlength="120" placeholder="Calle 123, Luján, Buenos Aires" value="'+esc(L.domicilio)+'"></label></div></div>';
  var el=$('#pg');if(!el)return;el.innerHTML=h;
  $('#vActs').innerHTML='<a class="btn sm ghost" href="/inicio" target="_blank" rel="noopener">'+ico('ext')+'Ver página</a><button class="btn sm" id="pGo">Guardar página</button>';
  $('#pGo').onclick=function(){guardarPlan()};
}
function leerPlan(){
  var p=PLAN;
  p.marca=$('#pMarca').value;p.instagram=$('#pIg').value;p.titulo=$('#pTitulo').value;p.bajada=$('#pBajada').value;p.precio=$('#pPrecio').value;p.periodo=$('#pPeriodo').value;p.alta=$('#pAlta').value;p.whatsapp=$('#pWa').value;p.email=$('#pMail').value;p.incluye=$('#pInc').value.split('\n');
  p.legal={titular:$('#lTit').value,cuit:$('#lCuit').value,email:$('#lMail').value,domicilio:$('#lDom').value};
  $$('[data-gt]').forEach(function(i){var g=(p.galeria||[])[+i.getAttribute('data-gt')];if(g)g.titulo=i.value});
  return p;
}
/* yaLeido: el plan en memoria ya tiene los cambios (se quitó o agregó una foto); no hay que volver a leer los campos de la pantalla. */
async function guardarPlan(silencio,yaLeido){
  var b=$('#pGo');if(b)b.disabled=true;
  var r=await api({accion:'plan',plan:yaLeido?PLAN:leerPlan()});
  if(b)b.disabled=false;
  if(!r.ok){toast(r.j.mensaje||'No se pudo guardar.','bad');return false}
  DATA.plan=r.j.plan;if(!silencio)toast('Guardado. Ya se ve en tu página.');
  cargarPlan();return true;
}
function achicar(file,maxW,limite,cb){
  if(!file||!/^image\//.test(file.type)){toast('Elegí una imagen.','bad');return}
  var fr=new FileReader();fr.onload=function(){var im=new Image();im.onload=function(){
    var k=Math.min(1,maxW/im.width),out='';
    for(var t=0;t<5&&!out;t++){var w=Math.round(im.width*k),h=Math.round(im.height*k),c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);
      var u=c.toDataURL('image/webp',[.82,.74,.66,.58,.5][t]);if(u.indexOf('data:image/webp')!==0)u=c.toDataURL('image/jpeg',[.82,.74,.66,.58,.5][t]);if(u.length<=limite)out=u;else k*=.85}
    if(!out){toast('La imagen es muy pesada.','bad');return}cb(out)};im.onerror=function(){toast('No pudimos abrir esa imagen.','bad')};im.src=fr.result};fr.readAsDataURL(file);
}
function subirSite(file,id,listo){
  toast('Subiendo…');
  achicar(file,1800,600000,async function(data){
    var res=await fetch('/api/foto?site=1',{method:'PUT',headers:{'x-super-password':encodeURIComponent(pw),'content-type':'application/json'},body:JSON.stringify({id:id,data:data})});
    var j=await res.json().catch(function(){return {}});
    if(!res.ok){toast(j.mensaje||'No se pudo subir.','bad');return}
    leerPlan();listo(j.v);await guardarPlan(true,true);toast('Imagen publicada.');
  });
}
document.addEventListener('change',function(e){
  if(e.target.id==='heroFile')subirSite(e.target.files[0],'hero',function(v){PLAN.hero=v});
  if(e.target.id==='galFile'){var id='g'+Math.random().toString(36).slice(2,9);subirSite(e.target.files[0],id,function(v){PLAN.galeria.push({id:id,v:v,titulo:''})})}
});

/* ---------- Clicks generales ---------- */
document.addEventListener('click',async function(e){
  var go=e.target.closest('[data-go]');
  if(go){if(go.hasAttribute('data-f'))FILTRO=go.getAttribute('data-f');ir(go.getAttribute('data-go'));return}
  var fl=e.target.closest('[data-fil]');if(fl){FILTRO=fl.getAttribute('data-fil');$$('#fil button').forEach(function(x){x.setAttribute('aria-pressed',x===fl)});$('#lista').innerHTML=listaLocales();return}
  var loc=e.target.closest('.loc[data-s]');if(loc){abrirLocal(loc.getAttribute('data-s'));return}
  var pg=e.target.closest('[data-pago]');
  if(pg){pg.disabled=true;var r=await api({accion:'pago',slug:pg.getAttribute('data-pago'),meses:1});if(r.ok){toast('Pago registrado: vence el '+fecha(r.j.local.venceEl)+'.');await recargar(true)}else{pg.disabled=false;toast(r.j.mensaje||'No se pudo.','bad')}return}
  var pa=e.target.closest('[data-pg]');
  if(pa){var a=pa.getAttribute('data-pg');leerPlan();if(a==='nohero')PLAN.hero='';if(a==='gdel')PLAN.galeria.splice(+pa.getAttribute('data-i'),1);await guardarPlan(true,true);toast('Listo.');return}
  var tr=e.target.closest('[data-tram]');
  if(tr){tr.disabled=true;var r2=await api({accion:'tramite',id:tr.getAttribute('data-tram'),estado:tr.getAttribute('data-est')});if(r2.ok){toast('Trámite actualizado.');await recargar(true)}else{tr.disabled=false;toast(r2.j.mensaje||'No se pudo.','bad')}return}
  var sa=e.target.closest('[data-sa]');
  if(sa){
    var act=sa.getAttribute('data-sa'),box=sa.closest('.card'),id=sa.getAttribute('data-id')||(box&&box.getAttribute('data-id'));
    if(act==='listo'){delete aprobados[id];pintar();return}
    if(act==='copiar'){copiar(credMsg(aprobados[id]),sa);return}
    var msg=box.querySelector('[data-e]');msg.textContent='';
    var lead=DATA.solicitudes.filter(function(l){return l.id===id})[0];
    if(act==='descartar'){if(!(await confirmar({tit:'¿Descartar la solicitud?',txt:lead.nombre+' no se va a enterar. Podés escribirle antes por WhatsApp.',si:'Descartar',peligro:true})))return;var r0=await api({accion:'solicitud_borrar',id:id});if(r0.ok){toast('Solicitud descartada.');await recargar(true)}return}
    if(act==='aprobar'){
      sa.disabled=true;
      var r3=await api({accion:'solicitud_aprobar',id:id,slug:box.querySelector('[data-f=slug]').value.trim().toLowerCase(),venceEl:box.querySelector('[data-f=vence]').value||undefined});
      if(!r3.ok){sa.disabled=false;msg.textContent=r3.j.mensaje||'No se pudo aprobar.';return}
      aprobados[id]={nombre:lead.nombre,url:r3.j.local.url||r3.j.local.slug,email:r3.j.local.email,password:r3.j.password,wa:r3.j.whatsapp};
      toast('Local creado.');await recargar(true);
    }
    return;
  }
  if(e.target.id==='nGo'){
    var b=e.target;$('#nerr').textContent='';b.disabled=true;
    var r4=await api({accion:'crear',nombre:$('#nNom').value.trim(),slug:$('#nSlug').value.trim().toLowerCase(),email:$('#nMail').value.trim(),whatsapp:$('#nWa').value,venceEl:$('#nVence').value||undefined});
    b.disabled=false;
    if(!r4.ok){$('#nerr').textContent=r4.j.mensaje||'No se pudo crear.';return}
    ultimaCred={nuevo:true,slug:r4.j.local.slug,nombre:r4.j.local.nombre,url:r4.j.local.url||r4.j.local.slug,email:r4.j.local.email,password:r4.j.password,wa:r4.j.local.whatsapp};
    toast('Local creado.');await recargar(true);return;
  }
  if(e.target.closest('#nCopy')){copiar(credMsg(ultimaCred),e.target.closest('#nCopy'));return}
});
document.addEventListener('keydown',function(e){var l=e.target.closest&&e.target.closest('.loc[data-s]');if(l&&(e.key==='Enter'||e.key===' ')){e.preventDefault();abrirLocal(l.getAttribute('data-s'))}});
document.addEventListener('input',function(e){
  if(e.target.id==='buscar'){Q=e.target.value;$('#lista').innerHTML=listaLocales()}
  if(e.target.id==='nNom'){var s=$('#nSlug');if(!s.getAttribute('data-touched')){s.value=slugDe(e.target.value);$('#nUrlHelp').textContent='Su tienda queda en '+(s.value||'tulocal')+'.'+(DATA.rootDomain||'tudominio.com')}}
  if(e.target.id==='nSlug'){e.target.setAttribute('data-touched','1');$('#nUrlHelp').textContent='Su tienda queda en '+(e.target.value||'tulocal')+'.'+(DATA.rootDomain||'tudominio.com')}
});

$('#lgo').addEventListener('click',entrar);
$('#sp').addEventListener('keydown',function(e){if(e.key==='Enter')entrar()});
setInterval(function(){if(DATA&&document.visibilityState==='visible'&&!$('#dLoc').open&&V!=='pagina'&&V!=='nuevo')recargar(true)},60000);
if(st.get('sp'))entrar();
