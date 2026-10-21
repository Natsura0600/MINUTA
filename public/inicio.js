'use strict';
var $=function(s){return document.querySelector(s)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var WA='5491152495689';
function telTxt(n){var d=String(n).replace(/\D/g,'');var m=d.match(/^549?(11|2\d{2}|3\d{2})(\d{3,4})(\d{4})$/);return m?'+54 '+m[1]+' '+m[2]+'-'+m[3]:'+'+d}
var FEAT_ICO='<svg class="ico"><use href="#i-listo"/></svg>';
var DEFAULT_INC=['Menú online con tu logo, tu color o tu banner, y la tipografía que va con tu local','Fotos de cada plato, etiquetas sin TACC y veggie, y platos destacados','Dirección propia para tu local','Comandas al instante con aviso sonoro y ticket para imprimir','Retiro en el local (con hora elegida por el cliente) y delivery con costo por barrio','Alias de transferencia por WhatsApp con un toque','Tus clientes siguen el pedido desde el celular','Ventas del día y lo más pedido, a la vista','Sin comisión por pedido'];
function pintarIncluye(inc){
  $('#feat').innerHTML=inc.map(function(x){return '<div>'+FEAT_ICO+'<span>'+esc(x)+'</span></div>'}).join('');
}
pintarIncluye(DEFAULT_INC);
function pintarPlan(p){
  if(p.titulo&&p.titulo!=='Tu menú online, tus pedidos, sin comisiones')$('#titulo').textContent=p.titulo;
  if(p.bajada)$('#bajada').textContent=p.bajada;
  document.title=(p.marca||'Minuta')+' · Pedidos a la minuta';
  $('#marca2').textContent=(p.marca||'Minuta')+' completo';
  $('#lnPrecio').hidden=!p.precio;$('#periodo').hidden=!p.precio;$('#consulta').hidden=!!p.precio;$("#precioVal").textContent=p.precio||'';
  $('#periodo').textContent=p.periodo||'';
  var al=$('#alta');al.hidden=!p.alta;al.textContent=p.alta||'';
  pintarIncluye(p.incluye&&p.incluye.length?p.incluye:DEFAULT_INC);
  var wa=p.whatsapp||WA,u='https://wa.me/'+wa,t=telTxt(wa);
  ['#telHero','#cWa','#fWa','#okWa'].forEach(function(s){$(s).href=u+'?text='+encodeURIComponent('¡Hola! Quiero Minuta para mi local.')});
  $('#telHero').textContent=t;$('#cWaTxt').textContent=t;$('#fWa').textContent='WhatsApp '+t;
  if(p.instagram){$('#cIg').hidden=false;$('#cIg').href='https://instagram.com/'+p.instagram;$('#cIgTxt').textContent='@'+p.instagram;$('#fIgLi').hidden=false;$('#fIg').href='https://instagram.com/'+p.instagram;$('#fIg').textContent='Instagram @'+p.instagram}
  if(p.email){$('#cMail').hidden=false;$('#cMail').href='mailto:'+p.email;$('#cMailTxt').textContent=p.email;$('#fMailLi').hidden=false;$('#fMail').href='mailto:'+p.email;$('#fMail').textContent=p.email}
  if(p.hero){$('#heroImg').src='/api/foto?site=1&id=hero&v='+encodeURIComponent(p.hero);$('#heroFoto').hidden=false;$('#heroTicket').hidden=true}
  var g=p.galeria||[];
  if(g.length){$('#galeriaSec').hidden=false;$('#galeria').innerHTML=g.map(function(x){return '<figure class="rv"><img loading="lazy" alt="'+esc(x.titulo)+'" src="/api/foto?site=1&id='+encodeURIComponent(x.id)+'&v='+encodeURIComponent(x.v)+'">'+(x.titulo?'<figcaption>'+esc(x.titulo)+'</figcaption>':'')+'</figure>'}).join('');observar()}
  var L=p.legal||{},tl=[];
  if(L.titular)tl.push(esc(L.titular));if(L.cuit)tl.push('CUIT '+esc(L.cuit));if(L.domicilio)tl.push(esc(L.domicilio));if(L.email)tl.push(esc(L.email));
  $('#titular').innerHTML=(tl.length?'Titular del servicio: '+tl.join(' · ')+'<br>':'')+'© '+new Date().getFullYear()+' '+esc(p.marca||'Minuta')+'. Los locales son responsables de sus productos, precios y entregas.';
}
fetch('/api/plan').then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.plan)pintarPlan(j.plan);else pintarPlan({})}).catch(function(){pintarPlan({})});

/* Aparición suave al hacer scroll */
var io=null;
function observar(){
  var els=document.querySelectorAll('.rv:not(.in)');
  if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in')});return}
  io=io||new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});
  els.forEach(function(e){io.observe(e)});
}
observar();

$('#f').addEventListener('submit',async function(e){
  e.preventDefault();
  var m=$('#msg'),b=$('#go');m.className='msg';m.textContent='';
  var data={nombre:$('#nombre').value.trim(),rubro:$('#rubro').value,whatsapp:$('#whatsapp').value.trim(),email:$('#email').value.trim(),zona:$('#zona').value.trim(),mensaje:$('#mensaje').value.trim(),web:$('#web').value};
  var bad=function(t,el){m.className='msg err';m.textContent=t;if(el)$(el).focus()};
  if(data.nombre.length<2)return bad('Escribí el nombre de tu local.','#nombre');
  if(data.whatsapp.replace(/\D/g,'').length<10)return bad('Escribí tu WhatsApp con código de área, por ejemplo 11 5555-1234.','#whatsapp');
  if(!/^\S+@\S+\.\S{2,}$/.test(data.email))return bad('Escribí un email válido.','#email');
  b.disabled=true;b.textContent='Enviando…';
  try{
    var r=await fetch('/api/suscribir',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
    var j=await r.json().catch(function(){return null});
    if(!r.ok){bad((j&&j.mensaje)||'No pudimos enviar la solicitud. Probá de nuevo.');b.disabled=false;b.textContent='Enviar solicitud';return}
    $('#f').hidden=true;$('#ok').hidden=false;$('#ok').scrollIntoView({behavior:'smooth',block:'center'});
  }catch(err){bad('No pudimos conectar. Revisá tu internet y probá de nuevo.');b.disabled=false;b.textContent='Enviar solicitud'}
});
