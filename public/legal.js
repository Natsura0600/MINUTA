'use strict';
var $=function(s){return document.querySelector(s)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var pag=(location.pathname.replace(/\/+$/,'').split('/').pop()||'').replace('.html','');
if(['terminos','privacidad','arrepentimiento'].indexOf(pag)<0)pag=new URLSearchParams(location.search).get('p')||'terminos';
document.querySelectorAll('[data-p]').forEach(function(a){if(a.getAttribute('data-p')===pag)a.setAttribute('aria-current','page')});
var P={marca:'Minuta',whatsapp:'5491152495689',email:'',legal:{}};

function titular(){
  var L=P.legal||{};
  return '<b>'+esc(L.titular||'[Nombre o razón social del titular]')+'</b>, CUIT '+esc(L.cuit||'[CUIT]')+', con domicilio en '+esc(L.domicilio||'[domicilio]')+' (en adelante, “'+esc(P.marca)+'”). Contacto: WhatsApp +54 11 5249-5689'+(L.email||P.email?' · '+esc(L.email||P.email):'');
}
function terminos(){
  return '<h1>Términos y condiciones</h1><p class="mute">Última actualización: '+new Date().toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'})+'</p>'+
  '<h2>1. Quiénes somos</h2><p>Este servicio lo presta '+titular()+'.</p>'+
  '<h2>2. Qué es Minuta</h2><p>Minuta es un software que permite a restaurantes, bodegones, rotiserías y otros locales gastronómicos (los “Locales”) publicar su menú online y recibir pedidos de sus clientes (los “Clientes”). Minuta no vende comida, no fija precios, no cobra los pedidos ni realiza entregas: cada pedido es una operación directa entre el Cliente y el Local.</p>'+
  '<h2>3. Responsabilidad de cada Local</h2><ul><li>Los productos, su calidad, su elaboración y las normas bromatológicas y de habilitación.</li><li>Los precios publicados, que deben ser finales, en pesos e incluir impuestos.</li><li>La información de alérgenos y la oferta de opciones sin TACC cuando corresponda.</li><li>La facturación a sus Clientes, los cobros, las entregas y la atención de reclamos sobre el pedido.</li><li>Los datos de sus Clientes, que usa solo para gestionar sus pedidos.</li></ul>'+
  '<h2>4. Clientes</h2><p>Al confirmar un pedido, el Cliente acepta que sus datos (nombre, teléfono y, si pide delivery, dirección) se compartan con el Local para preparar y entregar el pedido. Ante cualquier problema con un pedido, el Cliente debe contactar al Local por los medios que figuran en su menú.</p>'+
  '<h2>5. Suscripción de los Locales</h2><p>Los Locales pagan una mensualidad. Si la mensualidad no se paga a su vencimiento, el menú deja de tomar pedidos hasta regularizarla; los datos se conservan. El Local puede darse de baja en cualquier momento desde el <a href="/arrepentimiento?tipo=baja">botón de baja</a>, sin trámites adicionales.</p>'+
  '<h2>6. Arrepentimiento</h2><p>Quien contrata el servicio a distancia puede revocar la contratación dentro de los 10 días corridos, sin costo ni explicación, desde el <a href="/arrepentimiento?tipo=arrepentimiento">botón de arrepentimiento</a> (art. 34, Ley 24.240 y art. 1110 del Código Civil y Comercial). Este derecho no aplica a alimentos perecederos ya preparados o consumidos.</p>'+
  '<h2>7. Uso aceptable</h2><p>No se puede usar Minuta para vender productos ilegales, publicar contenido ajeno sin permiso ni intentar acceder a datos de otros Locales. Podemos suspender cuentas que incumplan estos términos.</p>'+
  '<h2>8. Disponibilidad</h2><p>Hacemos lo posible para que el servicio funcione siempre, pero puede haber interrupciones por mantenimiento o fallas de terceros (hosting, internet, WhatsApp).</p>'+
  '<h2>9. Reclamos</h2><p>Podés escribirnos por WhatsApp al +54 11 5249-5689. También podés hacer tu reclamo ante <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario" target="_blank" rel="noopener">Defensa de las y los consumidores</a>.</p>'+
  '<h2>10. Ley aplicable</h2><p>Se aplican las leyes de la República Argentina.</p>';
}
function privacidad(){
  return '<h1>Política de privacidad</h1><p class="mute">Última actualización: '+new Date().toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'})+'</p>'+
  '<h2>Responsable</h2><p>'+titular()+'.</p>'+
  '<h2>Qué datos tratamos</h2><ul><li><b>Locales:</b> nombre del local, email, WhatsApp, persona de contacto y datos de la mensualidad.</li><li><b>Clientes de los Locales:</b> nombre, teléfono, dirección de entrega (si pide delivery), el detalle del pedido y notas. Estos datos los recibe el Local y los usa solo para su pedido.</li><li><b>Solicitudes y trámites:</b> los datos que completes en los formularios de esta web.</li></ul>'+
  '<h2>Para qué</h2><p>Para prestar el servicio, gestionar pedidos, contactarte por tu solicitud y cumplir obligaciones legales. No vendemos ni cedemos datos a terceros para publicidad.</p>'+
  '<h2>Cuánto tiempo</h2><p>Los pedidos se borran automáticamente a los 90 días. Los datos de los Locales se conservan mientras dure el servicio y luego se eliminan.</p>'+
  '<h2>Dónde se guardan</h2><p>En servidores de proveedores de infraestructura en la nube (Vercel y Upstash), que pueden estar fuera de Argentina.</p>'+
  '<h2>Almacenamiento en tu navegador</h2><p>Guardamos en tu dispositivo tu carrito, tu último pedido y tus datos de contacto para que no tengas que escribirlos de nuevo. No usamos cookies de publicidad.</p>'+
  '<h2>Tus derechos</h2><p>Podés pedir acceso, rectificación o supresión de tus datos escribiéndonos por WhatsApp al +54 11 5249-5689'+((P.legal&&P.legal.email)||P.email?' o a '+esc((P.legal&&P.legal.email)||P.email):'')+'. Te respondemos dentro de los plazos de la Ley 25.326 (10 días corridos para el acceso y 5 días hábiles para rectificación o supresión).</p>'+
  '<p class="aviso">El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley N° 25.326. La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.</p>';
}
function arrepentimiento(){
  var t=new URLSearchParams(location.search).get('tipo')==='baja'?'baja':'arrepentimiento';
  return '<h1>Arrepentimiento y baja</h1><p class="mute">Sin registrarte y sin vueltas. Al enviar te mostramos el código de tu trámite y te lo confirmamos dentro de las 24 horas.</p>'+
  '<form id="f" novalidate><div class="tipos"><label><input type="radio" name="tipo" value="arrepentimiento"'+(t==='arrepentimiento'?' checked':'')+'>Arrepentimiento<small>Contrataste hace 10 días o menos y querés revocarlo.</small></label><label><input type="radio" name="tipo" value="baja"'+(t==='baja'?' checked':'')+'>Baja del servicio<small>Querés dejar de usar Minuta.</small></label></div>'+
  '<label>Tu nombre<input id="nombre" maxlength="60" autocomplete="name"></label><label>Email<input id="email" type="email" maxlength="120" autocomplete="email"></label>'+
  '<label>WhatsApp (opcional)<input id="whatsapp" type="tel" maxlength="20" autocomplete="tel"></label><label>Nombre del local (si sos un local)<input id="local" maxlength="60"></label>'+
  '<label>Detalle (opcional)<textarea id="detalle" rows="3" maxlength="400"></textarea></label><div class="hp" aria-hidden="true"><input id="web" tabindex="-1" autocomplete="off"></div>'+
  '<p class="err" id="err" role="alert"></p><button class="btn" id="go" type="submit">Enviar trámite</button></form><div class="cod" id="ok" hidden></div>'+
  '<p class="mute" style="font-size:14px">Si compraste comida en un local, el pedido es con ese local: escribile por WhatsApp desde su menú. Los alimentos perecederos no admiten arrepentimiento.</p>';
}
function pintar(){
  $('#main').innerHTML=({terminos:terminos,privacidad:privacidad,arrepentimiento:arrepentimiento})[pag]();
  document.title=P.marca+' · '+({terminos:'Términos',privacidad:'Privacidad',arrepentimiento:'Arrepentimiento y baja'})[pag];
  $('#pie').innerHTML='© '+new Date().getFullYear()+' '+esc(P.marca)+' · <a href="/inicio">Inicio</a> · <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario" target="_blank" rel="noopener">Defensa de las y los consumidores. Para reclamos ingrese aquí</a>';
  var f=$('#f');if(!f)return;
  f.addEventListener('submit',async function(e){
    e.preventDefault();var b=$('#go'),er=$('#err');er.textContent='';
    var d={tipo:(document.querySelector('input[name=tipo]:checked')||{}).value,nombre:$('#nombre').value.trim(),email:$('#email').value.trim(),whatsapp:$('#whatsapp').value.trim(),local:$('#local').value.trim(),detalle:$('#detalle').value.trim(),web:$('#web').value};
    if(d.nombre.length<2){er.textContent='Escribí tu nombre.';return}
    if(!/^\S+@\S+\.\S{2,}$/.test(d.email)){er.textContent='Escribí un email válido.';return}
    b.disabled=true;b.textContent='Enviando…';
    try{
      var r=await fetch('/api/tramite',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)});
      var j=await r.json().catch(function(){return null});
      if(!r.ok||!j||!j.codigo){er.textContent=(j&&j.mensaje)||'No pudimos registrar el trámite. Escribinos por WhatsApp al +54 11 5249-5689.';b.disabled=false;b.textContent='Enviar trámite';return}
      f.hidden=true;var ok=$('#ok');ok.hidden=false;
      ok.innerHTML='<span class="mute">Tu código de trámite</span><b>'+esc(j.codigo)+'</b><p style="margin:0">Guardalo. Te confirmamos la '+(j.tipo==='baja'?'baja':'revocación')+' por email dentro de las 24 horas.</p>';
    }catch(err){er.textContent='No pudimos conectar. Escribinos por WhatsApp al +54 11 5249-5689.';b.disabled=false;b.textContent='Enviar trámite'}
  });
}
pintar();
fetch('/api/plan').then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.plan){P=j.plan;if(pag!=='arrepentimiento')pintar();else $('#pie').innerHTML=$('#pie').innerHTML.replace(/Minuta/,esc(P.marca))}}).catch(function(){});
