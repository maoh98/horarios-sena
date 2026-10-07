// GENERADO por herramientas/sincronizar-reglas.mjs a partir de horario-sena.html. No editar a mano.
// Horario SENA · creado por el Ing. Manuel Alejandro Ordóñez Hernández

const RULES={START:6,END:18};
const TYPES={formacion:'Formación',planeacion:'Planeación',seguimiento:'Seguimiento'};
const PHVA={P:'Planear',H:'Hacer',V:'Verificar',A:'Actuar'};
const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DOWS=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DAY=86400000;
const pad=n=>String(n).padStart(2,'0');
const key=(y,m,d)=>`${y}-${pad(m)}-${pad(d)}`;
const parseKey=k=>{const [y,m,d]=k.split('-').map(Number);return{y,m,d}};
const utc=k=>{const p=parseKey(k);return Date.UTC(p.y,p.m-1,p.d)};
const dow=k=>new Date(utc(k)).getUTCDay();
const msKey=ms=>new Date(ms).toISOString().slice(0,10);
const fh=h=>pad(h)+':00';
function easterMs(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return Date.UTC(y,mo-1,da)}
function toMonday(ms){const w=new Date(ms).getUTCDay();return w===1?ms:ms+((8-w)%7)*DAY}
const _hol={};
function holidays(y){
  if(_hol[y])return _hol[y];
  const h={};const add=(ms,n)=>{h[msKey(ms)]=n};
  const fx=(m,d,n)=>add(Date.UTC(y,m-1,d),n), mv=(m,d,n)=>add(toMonday(Date.UTC(y,m-1,d)),n);
  const e=easterMs(y);
  fx(1,1,'Año Nuevo');mv(1,6,'Reyes Magos');mv(3,19,'San José');
  add(e-3*DAY,'Jueves Santo');add(e-2*DAY,'Viernes Santo');
  fx(5,1,'Día del Trabajo');
  add(toMonday(e+39*DAY),'Ascensión del Señor');add(toMonday(e+60*DAY),'Corpus Christi');add(toMonday(e+68*DAY),'Sagrado Corazón');
  mv(6,29,'San Pedro y San Pablo');fx(7,20,'Día de la Independencia');fx(8,7,'Batalla de Boyacá');
  mv(8,15,'Asunción de la Virgen');mv(10,12,'Día de la Raza');mv(11,1,'Todos los Santos');
  mv(11,11,'Independencia de Cartagena');fx(12,8,'Inmaculada Concepción');fx(12,25,'Navidad');
  return _hol[y]=h;
}
function isWorkable(k){
  const w=dow(k);
  if(w===0)return{ok:false,reason:'Domingo'};
  if(w===6)return{ok:false,reason:'Sábado'};
  const hn=holidays(parseKey(k).y)[k];
  if(hn)return{ok:false,reason:hn,holiday:true};
  return{ok:true,reason:''};
}
function limits(maxApoyo){const per=Math.max(1,maxApoyo-1);return{plan:per,seg:per,total:maxApoyo}}
function validateBlock(b,day,maxApoyo=2){
  if(!TYPES[b.type])return'Tipo de bloque no válido.';
  if(!Number.isInteger(b.start)||!Number.isInteger(b.hours)||b.hours<1)return'La hora de inicio y la duración deben ser números enteros (mínimo 1 h).';
  if(b.start<RULES.START)return'Antes de las 06:00 no se programa (la jornada va de 6 a. m. a 6 p. m.).';
  if(b.start+b.hours>RULES.END)return'Termina después de las 18:00; la jornada va de 6 a. m. a 6 p. m.';
  if(b.type==='formacion'&&!(b.comp&&b.rap&&b.ficha))return'La formación necesita ficha, competencia y RAP.';
  for(const o of day){if(b.start<o.start+o.hours&&o.start<b.start+b.hours)return`Se cruza con otro bloque (${fh(o.start)}–${fh(o.start+o.hours)}).`}
  if(b.type!=='formacion'){
    const L=limits(maxApoyo);
    const same=day.filter(o=>o.type===b.type).reduce((s,o)=>s+o.hours,0);
    const apoyo=day.filter(o=>o.type!=='formacion').reduce((s,o)=>s+o.hours,0);
    const per=b.type==='planeacion'?L.plan:L.seg;
    if(same+b.hours>per)return`Máximo ${per} h de ${TYPES[b.type].toLowerCase()} por día.`;
    if(apoyo+b.hours>L.total)return`Máximo ${L.total} h de apoyo (planeación + seguimiento) por día.`;
  }
  return null;
}
function indicators(blocks){
  const t={formacion:0,planeacion:0,seguimiento:0,total:0},byComp={},byRap={},byFicha={},byWeek={},days=new Set();
  for(const b of blocks){
    t[b.type]+=b.hours;t.total+=b.hours;days.add(b.date);
    if(b.type==='formacion'){byComp[b.comp]=(byComp[b.comp]||0)+b.hours;byRap[b.rap]=(byRap[b.rap]||0)+b.hours;byFicha[b.ficha]=(byFicha[b.ficha]||0)+b.hours}
    const wk=msKey(utc(b.date)-((dow(b.date)+6)%7)*DAY);byWeek[wk]=(byWeek[wk]||0)+b.hours;
  }
  return{t,byComp,byRap,byFicha,byWeek,days:days.size};
}
const PROG_MAX=3;
/** Horas de formación por grado y por programa. fichas=[{id,grado,programa}] */
function gradoHoras(blocks,fichas){
  const g={'10':0,'11':0,'?':0},p={},fm={};
  for(const f of fichas)fm[f.id]=f;
  for(const b of blocks){
    if(b.type!=='formacion')continue;
    const f=fm[b.ficha],gr=f&&(f.grado==='10'||f.grado==='11')?f.grado:'?',pg=f&&f.programa?f.programa:'?';
    g[gr]+=b.hours;(p[pg]=p[pg]||{'10':0,'11':0,'?':0})[gr]+=b.hours;
  }
  return{g,p};
}
/** Revisa que todo el horario encaje con las reglas. Devuelve la lista de problemas (vacía = perfecto). */
function auditar(blocks,o){
  const out=[],byDay={};
  for(const b of blocks)(byDay[b.date]=byDay[b.date]||[]).push(b);
  for(const d of Object.keys(byDay).sort()){
    const w=isWorkable(d);
    if(!w.ok){out.push(`${d}: ${w.holiday?'festivo ('+w.reason+')':w.reason.toLowerCase()}, no se programa.`);continue}
    const acc=[];
    for(const b of byDay[d].slice().sort((a,c)=>a.start-c.start)){
      const e=validateBlock(b,acc,o.maxApoyo||2);
      if(e)out.push(`${d} ${Number.isInteger(b.start)?fh(b.start):'?'}: ${e}`);else acc.push(b);
    }
  }
  const np=o.nProgramas||0,mp=o.maxProgramas||2;
  if(mp!==2&&mp!==3)out.push('El máximo de programas de formación debe ser 2 o 3.');
  else if(np>mp)out.push(`Tiene ${np} programas de formación y el máximo es ${mp}.`);
  if(np>0&&o.fichas){
    const used=new Set(blocks.filter(b=>b.type==='formacion'&&b.ficha).map(b=>b.ficha));
    o.fichas.forEach((f,i)=>{if(used.has(f.id)&&!f.programa)out.push(`La ficha ${i+1} tiene horas de formación pero no tiene programa asignado.`)});
  }
  return out;
}

export {gradoHoras, auditar, validateBlock, isWorkable, holidays, indicators};
