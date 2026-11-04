const K='xlevel_v1',$=s=>document.querySelector(s),TZ='America/Caracas';
const S={clients:[],plans:{Diario:[1,2],Semanal:[7,6],Quincenal:[15,12],Mensual:[30,20],Trimestral:[90,50]},f:'todos',shift:'',q:'',manualResetV1:false};
try{const r=localStorage.getItem(K);if(r)Object.assign(S,JSON.parse(r))}catch(e){}
if(!['Mañana','Tarde'].includes(S.shift))S.shift='';
const localSnapshot=()=>({clients:structuredClone(S.clients),plans:structuredClone(S.plans)});
const saveLocal=()=>{try{localStorage.setItem(K,JSON.stringify({clients:S.clients,plans:S.plans,manualResetV1:true}))}catch(e){notify('No se pudieron guardar los datos en este dispositivo. Libera espacio del navegador y vuelve a intentar.','error')}};
let cloud=null,cloudReady=false,synced={clients:[],plans:null},syncQueue=Promise.resolve(),cloudChannel=null;
function notify(message,type='info'){$('#app-notice').textContent=message;$('#app-notice').className='notice '+type}
const jsonEqual=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const save=()=>{
 saveLocal();
 if(!cloudReady)return;
 const snapshot=localSnapshot();
 const task=syncQueue.then(async()=>{
  const before=new Map(synced.clients.map(c=>[c.id,c])),after=new Map(snapshot.clients.map(c=>[c.id,c]));
  const changed=snapshot.clients.filter(c=>!before.has(c.id)||!jsonEqual(c,before.get(c.id)));
  const removed=[...before.keys()].filter(id=>!after.has(id));
  if(changed.length){const {error}=await cloud.from('clients').upsert(changed.map(c=>({id:c.id,data:c})));if(error)throw error}
  if(removed.length){const {error}=await cloud.from('clients').delete().in('id',removed);if(error)throw error}
  if(!jsonEqual(snapshot.plans,synced.plans)){const {error}=await cloud.from('gym_settings').upsert({id:'main',plans:snapshot.plans});if(error)throw error}
  synced={clients:snapshot.clients,plans:snapshot.plans};
 });
 syncQueue=task.catch(()=>{});
 task.then(()=>notify('Guardado y sincronizado.','success')).catch(error=>notify('No se pudo sincronizar: '+error.message,'error'));
};
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtCaracas=(d=new Date())=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const y=p.find(x=>x.type==='year')?.value,m=p.find(x=>x.type==='month')?.value,day=p.find(x=>x.type==='day')?.value;return `${y}-${m}-${day}`};
const iso=d=>{const y=d.getUTCFullYear(),m=String(d.getUTCMonth()+1).padStart(2,'0'),day=String(d.getUTCDate()).padStart(2,'0');return `${y}-${m}-${day}`};
const toD=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(Date.UTC(y,m-1,d,0,0,0))};
const T=()=>fmtCaracas(new Date()),diff=(a,b)=>Math.round((toD(a)-toD(b))/864e5);
const add=(s,n)=>{const d=toD(s);d.setUTCDate(d.getUTCDate()+n);return iso(d)},fd=s=>s.split('-').reverse().join('/');
const M=n=>'$'+(+n).toLocaleString('en-US',{maximumFractionDigits:2}),uid=()=>Math.random().toString(36).slice(2,10);
const price=p=>(S.plans[p]||[0,0])[1];
const lastU=c=>c.manualUntil||c.baseUntil||c.pays.reduce((m,p)=>p.until>m?p.until:m,'');
function info(c){const u=lastU(c);if(!u)return{u,d:null,s:'sin',debe:c.plan?price(c.plan):0};
 const d=diff(u,T()),s=d>7?'act':d>=0?'por':'mor';return{u,d,s,debe:s==='mor'?price(c.plan):0}}
function pay(c,date,plan,amt,met){const pv=lastU(c),b=pv&&pv>date?pv:date;
 const until=add(b,(S.plans[plan]||[30])[0]);
 c.pays.push({d:date,plan,amt:+amt,met,until});c.manualUntil=until;c.plan=plan}
const LB={act:'Activo',por:'Por vencer',mor:'Deudor',ina:'Inactivo',sin:'Sin pago'};
function wa(c,i){const n=esc(c.name.split(' ')[0]);let t={
 act:`Hola ${n}, gracias por tu pago 🙌 Tu membresía en X LEVEL está activa hasta el ${i.u&&fd(i.u)}. ¡Seguimos subiendo de nivel! 💪`,
 por:`Hola ${n} 👋 Te escribimos de X LEVEL. Tu membresía vence el ${i.u&&fd(i.u)}. Para que sigas entrenando sin pausa, puedes renovar cuando quieras 💪`,
 mor:`Hola ${n}, te escribimos de X LEVEL. Tu membresía venció el ${i.u&&fd(i.u)}. ¿Te ayudamos a renovarla para que retomes tu rutina? 🙏`,
 sin:`Hola ${n}, te escribimos de X LEVEL. Tienes tu membresía pendiente por pagar. ¿Te ayudamos a activarla? 💪`,
 ina:`Hola ${n}, te extrañamos en X LEVEL 💚 ¿Todo bien? Si quieres retomar tus entrenamientos, aquí te esperamos.`}[i.s];
 let x=(c.wa||'').replace(/\D/g,'');if(!x)return'';if(x[0]=='0')x='58'+x.slice(1);
 return `https://wa.me/${x}?text=${encodeURIComponent(t.replace(/&amp;/g,'&'))}`}
function render(){
 const L=S.clients.map(c=>({c,i:info(c)})),n=k=>L.filter(x=>x.i.s==k).length,mes=T().slice(0,7);
 const selected=!!S.shift;
 $('#st').style.display=selected?'':'none';
 $('.acts').style.display=selected?'':'none';
 $('#q').parentElement.style.display=selected?'':'none';
 $('#ch').style.display=selected?'':'none';
 const cob=S.clients.reduce((t,c)=>t+c.pays.filter(p=>p.d.slice(0,7)==mes).reduce((a,p)=>a+p.amt,0),0);
 const deb=L.reduce((t,x)=>t+x.i.debe,0);
 $('#st').innerHTML=[['Cobrado este mes',M(cob),'var(--g)'],['Por cobrar',M(deb),'var(--r)'],['Por vencer (7 días)',n('por'),'var(--y)'],['Deudores',n('mor'),'var(--r)']]
  .map(([a,b,c])=>`<div class="sc"><small>${a}</small><b style="color:${c}">${b}</b></div>`).join('');
 $('#ch').innerHTML=[['todos','Todos',L.length],['act','Activos'],['por','Por vencer'],['mor','Deudores'],['ina','Inactivos'],['sin','Sin pago']]
  .map(([k,l,v])=>`<button data-f="${k}" class="${S.f==k?'on':''}">${l} ${v??n(k)}</button>`).join('');
 $('#sh').innerHTML=[['Mañana','Clientes de mañana'],['Tarde','Clientes de tarde']]
  .map(([k,l])=>`<button data-shift="${k}" class="${S.shift==k?'on':''}">${l}</button>`).join('');
 const q=S.q.toLowerCase(),rk={sin:0,mor:1,por:2,act:3,ina:4};
 const V=L.filter(x=>(S.f=='todos'||x.i.s==S.f)&&x.c.shift==S.shift&&(x.c.name+x.c.ci+x.c.wa).toLowerCase().includes(q))
  .sort((a,b)=>rk[a.i.s]*1e4+(a.i.d||0)-(rk[b.i.s]*1e4+(b.i.d||0)));
 $('#list').innerHTML=!selected?'<div class="em">Elige un turno para ver sus clientes.</div>':V.length?V.map(({c,i})=>{const w=wa(c,i);return `<article class="cl ${i.s}"><div class="r1"><div><b>${esc(c.name)}</b><small>${esc(c.shift||'Sin turno')} · ${esc(c.plan||'Plan pendiente')}${c.wa?' · '+esc(c.wa):''}</small></div><span class="bd ${i.s}">${LB[i.s]}</span></div>
 <div class="r2"><div><small>Vence</small><b>${i.u?fd(i.u):'—'}</b></div><div><small>${i.d==null?'Días':i.d<0?'Venció hace':i.d==0?'Vence':'Quedan'}</small><b>${i.d==null?'—':i.d==0?'Hoy':Math.abs(i.d)+' '+(Math.abs(i.d)===1?'día':'días')}</b></div><div><small>Debe</small><b style="color:${i.debe?'var(--r)':'var(--s)'}">${i.debe?M(i.debe):'—'}</b></div></div>
 <div class="r3"><button class="pay" data-a="pay" data-id="${c.id}">Registrar pago</button>${w?`<a class="wa" href="${w}" target="_blank" rel="noopener">WhatsApp</a>`:''}<button data-a="edit" data-id="${c.id}">Editar</button></div></article>`}).join('')
 :`<div class="em">${S.clients.length?'Ningún cliente coincide con la búsqueda.':'Aún no hay clientes. Toca «Nuevo cliente» para empezar.'}</div>`}
const opts=()=>Object.keys(S.plans).map(p=>`<option>${esc(p)}</option>`).join('');
const dlg={};['dc','dp','dl'].forEach(k=>dlg[k]=$('#'+k));
['x1:dc','x2:dp','x3:dl'].forEach(s=>{const[a,b]=s.split(':');$('#'+a).onclick=()=>dlg[b].close()});
let cur=null,armed=false;
function openC(id){cur=S.clients.find(c=>c.id==id)||null;armed=false;$('#bd').textContent='Eliminar cliente';
 $('#f-plan').innerHTML='<option value="">Seleccionar plan</option>'+opts();$('#tc').textContent=cur?'Editar cliente':'Nuevo cliente';
 const c=cur||{name:'',ci:'',wa:'',plan:'Mensual',shift:S.shift||'Mañana',obj:'',les:'',em:''};
 const parts=c.name.trim().split(/\s+/);
 $('#f-name').value=parts.shift()||'';$('#f-last').value=parts.join(' ');$('#f-ci').value=c.ci;$('#f-wa').value=c.wa;$('#f-plan').value=c.plan;$('#f-shift').value=c.shift||'Mañana';$('#f-obj').value=c.obj;$('#f-les').value=c.les;$('#f-em').value=c.em;
 $('#f-start').value=cur?cur.start:T();$('#f-start').disabled=!!cur;$('#kinit').style.display='block';$('#kd').style.display=cur?'flex':'none';
 $('#f-initial').value=cur?'keep':'paid';$('#initial-edit-hint').style.display=cur?'block':'none';$('#f-initial-days').value='7';$('#f-initial').dispatchEvent(new Event('change'));dlg.dc.showModal()}
$('#f-initial').onchange=()=>{const mode=$('#f-initial').value,custom=mode==='remaining'||mode==='overdue';$('#initial-days-wrap').style.display=custom?'':'none';$('#f-initial-days').required=custom;$('#f-initial-days').min=mode==='overdue'?'1':'0';$('#initial-days-label').textContent=mode==='overdue'?'Días vencido':'Días que le quedan'};
$('#fc').onsubmit=e=>{e.preventDefault();const d={name:($('#f-name').value.trim()+' '+$('#f-last').value.trim()).trim(),ci:$('#f-ci').value.trim(),wa:$('#f-wa').value.trim(),plan:$('#f-plan').value,shift:$('#f-shift').value,obj:$('#f-obj').value.trim(),les:$('#f-les').value.trim(),em:$('#f-em').value.trim()};
 if(cur)Object.assign(cur,d);else{const c={id:uid(),start:$('#f-start').value,pays:[],...d};S.clients.push(c)}
 const mode=$('#f-initial').value;
 if(mode==='paid'){
  if(cur)cur.manualUntil=add(T(),(S.plans[d.plan]||[30])[0]);
  else pay(S.clients[S.clients.length-1],d.start,d.plan,price(d.plan),'Efectivo');
 }else if(mode==='remaining'||mode==='overdue'){
  const days=Number($('#f-initial-days').value),client=cur||S.clients[S.clients.length-1];
  client.manualUntil=add(T(),mode==='overdue'?-days:days);
 }
 save();render();dlg.dc.close()};
$('#bd').onclick=()=>{if(!armed){armed=true;$('#bd').textContent='Toca otra vez para confirmar';return}
 S.clients=S.clients.filter(c=>c!==cur);save();render();dlg.dc.close()};
const upd=()=>{const p=$('#p-plan').value,b=lastU(cur),d=$('#p-date').value;
 $('#p-u').textContent=d?'Quedará cubierto hasta el '+fd(add(b&&b>d?b:d,(S.plans[p]||[0])[0])):''};
function openP(id){cur=S.clients.find(c=>c.id==id);$('#tp').textContent='Pago de '+cur.name;$('#p-plan').innerHTML=opts();
 $('#p-plan').value=cur.plan;$('#p-date').value=T();$('#p-amt').value=price(cur.plan);upd();dlg.dp.showModal()}
$('#p-plan').onchange=()=>{$('#p-amt').value=price($('#p-plan').value);upd()};$('#p-date').onchange=upd;
$('#fp').onsubmit=e=>{e.preventDefault();pay(cur,$('#p-date').value,$('#p-plan').value,$('#p-amt').value,$('#p-met').value);save();render();dlg.dp.close()};
function openL(){const r=Object.entries(S.plans).map(([k,[d,p]])=>[k,d,p]);r.push(['',30,0]);
 $('#pl').innerHTML=r.map(([k,d,p],i)=>`<div class="g2" style="margin-top:8px"><div class="g2"><input data-n value="${esc(k)}" placeholder="Nuevo plan"><input data-d type="number" min="1" value="${d}"></div><input data-p type="number" min="0" step="0.01" value="${p}"></div>`).join('');dlg.dl.showModal()}
$('#fl').onsubmit=e=>{e.preventDefault();const o={};document.querySelectorAll('#pl>.g2').forEach(r=>{const k=r.querySelector('[data-n]').value.trim();
 if(k)o[k]=[+r.querySelector('[data-d]').value||1,+r.querySelector('[data-p]').value||0]});
 if(Object.keys(o).length){S.plans=o;S.clients.forEach(c=>{if(!o[c.plan])c.plan=Object.keys(o)[0]})}save();render();dlg.dl.close()};
$('#bn').onclick=()=>openC();$('#bp').onclick=openL;$('#q').oninput=e=>{S.q=e.target.value;render()};
$('#sh').onclick=e=>{const b=e.target.closest('[data-shift]');if(b){S.shift=b.dataset.shift;S.f='todos';render()}};
$('#ch').onclick=e=>{const b=e.target.closest('[data-f]');if(b){S.f=b.dataset.f;render()}};
$('#list').onclick=e=>{const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
 if(a=='pay')openP(b.dataset.id);else if(a=='edit')openC(b.dataset.id);};
const showGate=(message,allowLogin=true)=>{
 $('#gate').hidden=false;$('#app').hidden=true;$('#gate-message').textContent=message;
 $('#login-form').hidden=!allowLogin;$('#import-local').hidden=true;$('#logout').hidden=true;
};
async function loadCloud(cache=true){
 const local=cache?localSnapshot():null;
 const previous=synced;
 const [{data:access,error:accessError},{data:rows,error:clientError},{data:settings,error:settingsError}]=await Promise.all([
  cloud.from('staff_access').select('email,display_name').eq('email',activeEmail).maybeSingle(),
  cloud.from('clients').select('id,data'),
  cloud.from('gym_settings').select('plans').eq('id','main').maybeSingle()
 ]);
 if(accessError)throw accessError;
 if(!access)throw new Error('Este correo no tiene acceso autorizado.');
 if(!selectedStaff||access.display_name!==selectedStaff)throw new Error('La selección no coincide con la cuenta autorizada.');
 if(clientError)throw clientError;
 if(settingsError)throw settingsError;
 const remoteClients=(rows||[]).map(row=>({...row.data,id:row.id,pays:row.data.pays||[]}));
 const remotePlans=settings?.plans||S.plans;
 let hasLocalChanges=false;
 if(cache){
  const before=new Map(previous.clients.map(c=>[c.id,c])),localById=new Map(local.clients.map(c=>[c.id,c])),remoteById=new Map(remoteClients.map(c=>[c.id,c]));
  for(const client of local.clients)if(!before.has(client.id)||!jsonEqual(client,before.get(client.id))){remoteById.set(client.id,client);hasLocalChanges=true}
  for(const id of before.keys())if(!localById.has(id)){remoteById.delete(id);hasLocalChanges=true}
  const plansChanged=previous.plans&&!jsonEqual(local.plans,previous.plans);
  S.clients=[...remoteById.values()];
  S.plans=plansChanged?local.plans:remotePlans;
  hasLocalChanges=hasLocalChanges||plansChanged;
 }else{
  S.clients=remoteClients;
  S.plans=remotePlans;
 }
 synced={clients:remoteClients,plans:remotePlans};
 if(cache)saveLocal();
 render();
 if(hasLocalChanges)save();
 return{fresh:!settings,hasCloudClients:S.clients.length>0};
}
let activeUser=null,activeEmail='',loadingUser=null,channelTimer=null,selectedStaff='';
function scheduleCloudReload(){
 clearTimeout(channelTimer);
 channelTimer=setTimeout(async()=>{
  if(dlg.dc.open||dlg.dp.open||dlg.dl.open){scheduleCloudReload();return}
  try{await syncQueue;await loadCloud();notify('Datos actualizados desde la nube.','success')}
  catch(error){notify('No se pudieron actualizar los datos: '+error.message,'error')}
 },350);
}
async function activateSession(session){
 if(!session){activeUser=null;loadingUser=null;cloudReady=false;if(cloudChannel){cloud.removeChannel(cloudChannel);cloudChannel=null}showGate('Inicia sesión con tu cuenta autorizada para acceder al control del gimnasio.');return}
 if(!selectedStaff){activeUser=null;cloudReady=false;showGate('Selecciona quién está entrando y accede con la cuenta asignada a esa persona.');return}
 if(activeUser===session.user.id&&(cloudReady||loadingUser===session.user.id))return;
 activeUser=session.user.id;cloudReady=false;
 loadingUser=session.user.id;
 showGate('Conectando y sincronizando los datos...',false);
 try{
  activeEmail=session.user.email?.toLowerCase()||'';
  const state=await loadCloud(false);
  if(state.fresh&&!state.hasCloudClients&&JSON.parse(localStorage.getItem(K)||'{}').clients?.length){
   $('#gate-message').textContent='Encontramos clientes guardados en este dispositivo. Súbelos una vez para compartirlos con todo el equipo.';
   $('#import-local').hidden=false;$('#login-form').hidden=true;loadingUser=null;return;
  }
  saveLocal();cloudReady=true;loadingUser=null;$('#gate').hidden=true;$('#app').hidden=false;$('#logout').hidden=false;notify('Conectado. Los cambios se sincronizan entre dispositivos.','success');
  if(cloudChannel)cloud.removeChannel(cloudChannel);
  cloudChannel=cloud.channel('gym-live-sync')
   .on('postgres_changes',{event:'*',schema:'public',table:'clients'},scheduleCloudReload)
   .on('postgres_changes',{event:'*',schema:'public',table:'gym_settings'},scheduleCloudReload)
   .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')notify('La sincronización en tiempo real se interrumpió. Revisa tu conexión.','error')});
 }catch(error){activeUser=null;loadingUser=null;showGate('No se pudo validar el acceso. '+error.message);$('#gate-error').textContent=error.message}
}
$('#login-form').onsubmit=async e=>{
 e.preventDefault();selectedStaff=$('#login-staff').value;$('#gate-error').textContent='Iniciando sesión...';
 if(!selectedStaff){$('#gate-error').textContent='Selecciona tu usuario antes de continuar.';return}
 const {error}=await cloud.auth.signInWithPassword({email:$('#login-email').value.trim(),password:$('#login-password').value});
 $('#gate-error').textContent=error?error.message:'';
};
$('#logout').onclick=async()=>{selectedStaff='';$('#login-staff').value='';const {error}=await cloud.auth.signOut();if(error)notify('No se pudo cerrar sesión: '+error.message,'error')};
$('#import-local').onclick=async()=>{
 const saved=JSON.parse(localStorage.getItem(K)||'{}');
 const clients=saved.clients||[];
 try{
  if(clients.length){const {error}=await cloud.from('clients').upsert(clients.map(c=>({id:c.id,data:c})));if(error)throw error}
  const {error}=await cloud.from('gym_settings').upsert({id:'main',plans:saved.plans||S.plans});if(error)throw error;
  $('#import-local').hidden=true;$('#login-form').hidden=true;const {data:{session}}=await cloud.auth.getSession();activeUser=null;await activateSession(session);
 }catch(error){$('#gate-error').textContent='No se pudieron subir los datos: '+error.message}
};
const config=window.XLEVEL_SUPABASE_CONFIG;
if(!config?.url||!config?.anonKey||config.url.includes('YOUR_')||config.anonKey.includes('YOUR_')||!window.supabase?.createClient){
 showGate('La sincronización compartida aún no está configurada. Completa supabase-config.js y ejecuta supabase-setup.sql en tu proyecto Supabase.',false);
}else{
 cloud=window.supabase.createClient(config.url,config.anonKey);
 cloud.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>activateSession(session),0)});
 cloud.auth.getSession().then(({data,error})=>{
  if(error)throw error;
  return activateSession(data.session);
 }).catch(error=>showGate('No se pudo iniciar la sesión: '+error.message));
}
