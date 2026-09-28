import { createHash } from 'node:crypto';
// A standalone offline worksheet, not an authenticated administrative surface.
function reviewer() {
  const plan=JSON.parse(document.getElementById('mapping-data').textContent);
  const names={organization:'Empresa',project:'Obra',worker:'Trabajador',task:'Tarea'};
  const labels={UNREVIEWED:'Sin revisar',LINK_EXISTING:'Proponer vínculo',DEFER:'Diferir'};
  const reasons={DOCUMENTED_MATCH:'Contrastado con fuente autorizada',NEEDS_EVIDENCE:'Falta evidencia',NO_CANONICAL_TARGET:'No hay destino canónico',CONFLICTING_SCOPE:'Ámbito en conflicto'};
  const list=document.getElementById('records'),filter=document.getElementById('filter');
  const byRef=new Map(plan.records.map(row=>[row.sourceRef,row]));
  const byTarget=new Map(plan.targets.map(row=>[row.targetRef,row]));
  const make=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
  function option(select,value,text){const item=make('option',text);item.value=value;select.append(item);return item;}
  function controls(row,label){const wrapper=make('label',label),input=make('select');input.setAttribute('aria-label',label+' '+names[row.kind]+' '+row.ordinal);wrapper.append(input);return {wrapper,input};}
  function summary(){
    const count=action=>plan.records.filter(row=>row.action===action).length;
    document.getElementById('summary').textContent=count('UNREVIEWED')+' pendientes · '+count('LINK_EXISTING')+' vínculos propuestos · '+count('DEFER')+' diferidos';
  }
  function render(){
    list.replaceChildren();
    for(const row of plan.records.filter(item=>filter.value==='all'||filter.value===item.kind)) {
      const card=make('article',undefined,'record');card.dataset.sourceRef=row.sourceRef;
      const head=make('div',undefined,'record-head');head.append(make('h2',names[row.kind]+' '+row.ordinal),make('span','Fuente '+row.sourceGroup,'pill'));card.append(head);
      card.append(make('p','Referencia '+row.sourceRef.slice(-12)+' · '+row.candidates.length+' candidatos por identificador','meta'));
      if(row.warnings.length)card.append(make('p','Requiere revisión: '+row.warnings.join(' · '),'warning'));
      const grid=make('div',undefined,'controls');
      const action=controls(row,'Decisión');for(const key of Object.keys(labels))option(action.input,key,labels[key]);action.input.value=row.action;
      const target=controls(row,'Destino');option(target.input,'','Seleccionar explícitamente');
      for(const value of plan.targets.filter(item=>item.kind===row.kind))option(target.input,value.targetRef,names[value.kind]+' destino '+value.ordinal+(value.kind!=='organization'?' · Empresa '+byTarget.get(value.organizationRef)?.ordinal:'')+(['worker','task'].includes(value.kind)?' · Obra '+byTarget.get(value.projectRef)?.ordinal:'')+(row.candidates.includes(value.targetRef)?' · candidato por ID':''));
      target.input.value=row.targetRef||'';target.input.disabled=row.action!=='LINK_EXISTING';
      const parent=controls(row,'Pertenencia');option(parent.input,'','Seleccionar vínculo padre');

      for(const value of plan.records.filter(item=>item.groupRef===row.groupRef&&item.kind===(row.kind==='project'?'organization':'project'))) {
        const node=option(parent.input,value.sourceRef,names[value.kind]+' '+value.ordinal+(value.action==='LINK_EXISTING'?' · propuesto':' · sin vínculo'));node.disabled=value.action!=='LINK_EXISTING';
      }
      parent.input.value=row.parentSourceRef||'';parent.input.disabled=row.action!=='LINK_EXISTING'||row.kind==='organization';
      const reason=controls(row,'Motivo');option(reason.input,'','Elegir motivo');
      for(const key of Object.keys(reasons).filter(key=>row.action==='LINK_EXISTING'?key==='DOCUMENTED_MATCH':key!=='DOCUMENTED_MATCH'))option(reason.input,key,reasons[key]);
      reason.input.value=row.reason||'';reason.input.disabled=row.action==='UNREVIEWED';
      action.input.onchange=()=>{Object.assign(row,{action:action.input.value,targetRef:null,parentSourceRef:null,reason:null});render();};
      target.input.onchange=()=>{row.targetRef=target.input.value||null;summary();};
      parent.input.onchange=()=>{row.parentSourceRef=parent.input.value||null;summary();};
      reason.input.onchange=()=>{row.reason=reason.input.value||null;summary();};
      grid.append(action.wrapper,target.wrapper,parent.wrapper,reason.wrapper);card.append(grid);list.append(card);
    }
    if(!list.children.length)list.append(make('p','No hay registros de este tipo.','empty'));summary();
  }
  filter.onchange=render;
  document.getElementById('export').onclick=()=>{
    for(const row of plan.records)if(row.action==='LINK_EXISTING'&&row.kind!=='organization'&&byRef.get(row.parentSourceRef)?.action!=='LINK_EXISTING') {
      document.getElementById('notice').textContent='Hay vínculos sin pertenencia revisada. La propuesta conserva estos pendientes; no autoriza importaciones.';break;
    }
    const content=JSON.stringify(plan,null,2)+'\n',url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
    const link=make('a');link.href=url;link.download='mapping-decisions.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    document.getElementById('notice').textContent='Propuesta exportada. Guardala dentro de .vercel y verificá contra una lectura nueva. No se modificó ningún registro.';
  };
  render();
}
const hash=value=>createHash('sha256').update(value).digest('base64');

export function renderLegacyMappingReview(plan) {
  const data=JSON.stringify(plan).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  const script=('('+reviewer.toString()+')();').replace(/\r\n?/g,'\n');
  const css=`*{box-sizing:border-box}body{margin:0;background:#060913;color:#edf3fc;font:15px system-ui,sans-serif;line-height:1.55}main{max-width:1240px;margin:auto;padding:32px 24px 72px}header,.record,.note,.toolbar{border:1px solid #28344b;border-radius:16px;background:#0d1525;padding:24px;margin-bottom:16px}header{background:linear-gradient(135deg,#101c30,#0b1220)}.eyebrow{color:#9fc7ff;font-size:11px;font-weight:800;letter-spacing:.13em}h1{margin:10px 0;font-size:clamp(27px,4vw,39px);letter-spacing:-.025em;line-height:1.18}header p,.note p,.meta{color:#b2c2d9}.note{border-left:3px solid #f7bc57}.note summary{color:#ffdb99;font-weight:700;cursor:pointer;min-height:28px}.note summary:focus-visible{outline:3px solid #b8d7ff;outline-offset:5px}.toolbar,.record-head{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.toolbar{position:sticky;top:8px;z-index:1;background:#0d1525f5}h2{margin:0;font-size:19px}.pill{color:#b7d7ff;border:1px solid #365477;border-radius:20px;padding:5px 11px;font-size:12px}.meta{font-size:12px;overflow-wrap:anywhere}.controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.controls label{min-width:0;display:grid;gap:7px;font-size:12px;color:#bdcce1}select{min-width:0;width:100%}select,button{font:inherit;min-height:44px;max-width:100%;border:1px solid #3b4c68;border-radius:9px;padding:10px;background:#0a1322;color:#eef5ff}button{background:#83b6ff;color:#07101c;font-weight:800;cursor:pointer}select:disabled{opacity:.55}select:focus-visible,button:focus-visible{outline:3px solid #b8d7ff;outline-offset:3px}#summary{font-weight:600;margin:18px 0;color:#c7ddfa}#notice{min-height:24px;color:#b4eac8}.warning{color:#ffcf84;font-size:13px;overflow-wrap:anywhere}.empty{padding:20px;color:#bed0e8}@media(max-width:640px){main{padding:16px 12px 40px}header,.record,.note,.toolbar{padding:18px}.controls{grid-template-columns:minmax(0,1fr)}select{font-size:16px}.toolbar{position:static}.toolbar>*{width:100%}h2{font-size:17px}}`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(css)}'; connect-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'"><title>ObraSaaS · Conciliación de identidades</title><style>${css}</style></head><body><main>
    <header><div class="eyebrow">OBRASAAS · PREPARACIÓN DEL PASE ENTERPRISE</div><h1>Conciliación de empresa y obra</h1><p>Proponé vínculos explícitos entre identidades históricas y destinos existentes. Las coincidencias por identificador son candidatas, no decisiones.</p></header>
    <details class="note"><summary>Revisión local · sin escrituras ni autorización</summary><p>Las referencias ocultan los valores originales. Fuente y ordinal permiten localizar el registro en la fuente autorizada; no son nombres de personas ni pruebas de propiedad. Contrastá esa fuente antes de proponer un vínculo.</p><p>No se importan mensajes, KYC, recibos ni certificados. Exportar no firma ni aprueba una migración. La comprobación final exige una lectura nueva del catálogo y valida pertenencia, duplicados y cambios.</p></details>
    <div class="toolbar"><label>Tipo de registro <select id="filter"><option value="all">Todos</option><option value="organization">Empresas</option><option value="project">Obras</option><option value="worker">Trabajadores</option><option value="task">Tareas</option></select></label><button id="export" type="button">Exportar propuesta JSON</button></div>
    <p id="summary" role="status"></p><p id="notice" role="status"></p><section id="records" aria-label="Registros por revisar"></section>
    <noscript>Esta hoja necesita JavaScript local para editar propuestas. El archivo manifest.json conserva todos los registros.</noscript>
    </main><script type="application/json" id="mapping-data">${data}</script><script>${script}</script></body></html>`;
}
