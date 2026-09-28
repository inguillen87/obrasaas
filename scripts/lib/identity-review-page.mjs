import {createHash} from 'node:crypto';
function evidenceReviewer() {
  const initial=JSON.parse(document.getElementById('identity-data').textContent);
  const proposal=structuredClone(initial.proposal),plan=proposal.plan,context=initial.context;
  const names={organization:'Empresa',project:'Obra',worker:'Trabajador',task:'Tarea'};
  const sourceMeta=new Map(context.records.map(row=>[row.sourceRef,row]));
  const targetMeta=new Map(context.targets.map(row=>[row.targetRef,row]));
  const byRef=new Map(plan.records.map(row=>[row.sourceRef,row]));
  const byTarget=new Map(plan.targets.map(row=>[row.targetRef,row]));
  const list=document.getElementById('records'),type=document.getElementById('kind');
  const status=document.getElementById('state'),search=document.getElementById('search');
  const notice=document.getElementById('notice');let dirty=false;
  const labels={UNREVIEWED:'Sin revisar',LINK_EXISTING:'Proponer vínculo',DEFER:'Dejar pendiente con motivo'};
  const reasons={NEEDS_EVIDENCE:'Falta evidencia de pertenencia',NO_CANONICAL_TARGET:'No existe el destino correspondiente',CONFLICTING_SCOPE:'Pertenencia en conflicto'};
  const node=(tag,text,className)=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=text;if(className)item.className=className;return item;};
  const sourceName=row=>sourceMeta.get(row.sourceRef)?.label||names[row.kind]+' sin nombre · '+row.ordinal;
  const destinationName=target=>targetMeta.get(target.targetRef)?.label||names[target.kind]+' destino '+target.ordinal;
  const option=(select,value,text,disabled=false)=>{const item=node('option',text);item.value=value;item.disabled=disabled;select.append(item);};
  function field(row,title){const wrapper=node('label',title),input=node('select');input.setAttribute('aria-label',title+' '+names[row.kind]+' '+row.ordinal);wrapper.append(input);return {wrapper,input};}
  function resetChildren(reference){
    const children=plan.records.filter(row=>row.parentSourceRef===reference);
    for(const child of children){resetChildren(child.sourceRef);Object.assign(child,{action:'UNREVIEWED',targetRef:null,parentSourceRef:null,reason:null});}
    return children.length;
  }
  function changed(row,patch){const cleared=resetChildren(row.sourceRef);Object.assign(row,patch);dirty=true;
    notice.textContent=cleared?'Se retiraron propuestas dependientes: revisá nuevamente su pertenencia.':'Cambio local sin escrituras en la base.';render();}
  function problems(){
    const errors=[],targets=new Set();
    for(const row of plan.records){
      if(row.action==='DEFER'&&!Object.hasOwn(reasons,row.reason))errors.push('Elegí el motivo pendiente de '+sourceName(row)+'.');
      if(row.action!=='LINK_EXISTING')continue;
      const target=byTarget.get(row.targetRef),parent=byRef.get(row.parentSourceRef);
      if(!target||target.kind!==row.kind||row.reason!=='DOCUMENTED_MATCH')errors.push('Completá destino y contraste documental de '+sourceName(row)+'.');
      if(targets.has(row.targetRef))errors.push('Un mismo destino no puede recibir dos identidades históricas.');targets.add(row.targetRef);
      if(row.kind!=='organization'&&(!parent||parent.action!=='LINK_EXISTING'||parent.groupRef!==row.groupRef||parent.reason!=='DOCUMENTED_MATCH'))errors.push('Revisá primero la pertenencia de '+sourceName(row)+'.');
      if(target&&parent&&(row.kind==='project'?target.organizationRef!==parent.targetRef:target.projectRef!==parent.targetRef))errors.push('La pertenencia no coincide con el destino.');
      if(row.warnings.length)errors.push('Existe un conflicto en la fuente de '+sourceName(row)+'.');
    }
    return errors;
  }
  function render(){
    list.replaceChildren();const query=search.value.trim().toLocaleLowerCase('es');
    for(const row of plan.records){
      const meta=sourceMeta.get(row.sourceRef);
      if(type.value!=='all'&&row.kind!==type.value||status.value!=='all'&&row.action!==status.value)continue;
      if(query&&!`${sourceName(row)} ${row.sourceRef} ${names[row.kind]}`.toLocaleLowerCase('es').includes(query))continue;
      const card=node('article',undefined,'record');card.dataset.sourceRef=row.sourceRef;
      const heading=node('div',undefined,'heading');heading.append(node('span',names[row.kind]+' · '+row.ordinal,'pill'),node('h2',sourceName(row)));card.append(heading);
      card.append(node('p','Fuente '+row.sourceGroup+' · Referencia '+row.sourceRef.slice(-12),'muted small'));
      const duplicate=context.duplicateSources.find(group=>group.includes(row.sourceRef));
      if(duplicate)card.append(node('p','Nombre repetido en '+duplicate.length+' registros históricos. No fusionar por nombre.','warning'));
      if(meta.idCandidateRefs.length)card.append(node('p',meta.idCandidateRefs.length+' candidato(s) por identificador. Verificá su empresa y obra.','evidence'));
      if(meta.nameCandidateRefs.length)card.append(node('p',meta.nameCandidateRefs.length+' coincidencia(s) de nombre. No prueba identidad ni pertenencia.','evidence'));
      if(!meta.idCandidateRefs.length&&!meta.nameCandidateRefs.length)card.append(node('p','Sin coincidencias por nombre o identificador en el catálogo actual.','muted'));
      const scopes=node('div',undefined,'source-context');
      if(row.kind!=='organization'&&!meta.declaredScope.length)scopes.append(node('p','La fuente no declara una pertenencia verificable. No se usa la obra seleccionada como valor por defecto.'));
      for(const scope of meta.declaredScope){const descriptions=scope.sourceMatches.map(ref=>sourceName(byRef.get(ref))).concat(scope.targetMatches.map(ref=>destinationName(byTarget.get(ref))));scopes.append(node('p',(scope.kind==='organization'?'Empresa declarada: ':'Obra declarada: ')+(descriptions.join(' / ')||'No resuelta en el catálogo')));}
      card.append(scopes);
      if(row.warnings.length)card.append(node('p','Conflicto de origen: '+row.warnings.join(' · '),'warning'));
      const grid=node('div',undefined,'controls'),action=field(row,'Decisión');
      for(const [value,label] of Object.entries(labels))option(action.input,value,label);action.input.value=row.action;
      action.input.onchange=()=>changed(row,{action:action.input.value,targetRef:null,parentSourceRef:null,reason:null});grid.append(action.wrapper);
      const parent=field(row,'Empresa u obra de origen');option(parent.input,'','Revisar y elegir pertenencia');
      for(const other of plan.records.filter(item=>item.groupRef===row.groupRef&&item.kind===(row.kind==='project'?'organization':'project')))option(parent.input,other.sourceRef,sourceName(other)+' · '+other.ordinal+(other.action==='LINK_EXISTING'?' · propuesta':' · pendiente'),other.action!=='LINK_EXISTING'||other.reason!=='DOCUMENTED_MATCH');
      parent.input.value=row.parentSourceRef||'';parent.input.disabled=row.kind==='organization'||row.action!=='LINK_EXISTING';
      parent.input.onchange=()=>changed(row,{parentSourceRef:parent.input.value||null,targetRef:null,reason:null});grid.append(parent.wrapper);
      const target=field(row,'Destino existente'),selectedParent=byRef.get(row.parentSourceRef);option(target.input,'','Seleccionar un destino explícito');
      const possible=plan.targets.filter(item=>item.kind===row.kind&&(row.kind==='organization'||selectedParent?.targetRef&&(row.kind==='project'?item.organizationRef===selectedParent.targetRef:item.projectRef===selectedParent.targetRef)));
      for(const item of possible){const detail=targetMeta.get(item.targetRef);option(target.input,item.targetRef,destinationName(item)+' · '+item.ordinal+(row.kind!=='organization'?' | '+(detail.organizationLabel||'Empresa sin nombre'):'')+(['worker','task'].includes(row.kind)?' | '+(detail.projectLabel||'Obra sin nombre'):'')+(meta.idCandidateRefs.includes(item.targetRef)?' · coincide ID':meta.nameCandidateRefs.includes(item.targetRef)?' · coincide nombre':''));}
      target.input.value=row.targetRef||'';target.input.disabled=row.action!=='LINK_EXISTING'||row.kind!=='organization'&&!selectedParent?.targetRef;
      target.input.onchange=()=>changed(row,{targetRef:target.input.value||null,reason:null});grid.append(target.wrapper);
      if(row.action==='DEFER'){const reason=field(row,'Motivo pendiente');option(reason.input,'','Elegir motivo');for(const [value,label] of Object.entries(reasons))option(reason.input,value,label);reason.input.value=row.reason||'';reason.input.onchange=()=>changed(row,{reason:reason.input.value||null});grid.append(reason.wrapper);}
      card.append(grid);
      if(row.action==='LINK_EXISTING'){
        const label=node('label',undefined,'attestation'),checkbox=node('input');checkbox.type='checkbox';checkbox.checked=row.reason==='DOCUMENTED_MATCH';checkbox.disabled=!row.targetRef;
        checkbox.setAttribute('aria-label','Contraste documental '+names[row.kind]+' '+row.ordinal);
        checkbox.onchange=()=>changed(row,{reason:checkbox.checked?'DOCUMENTED_MATCH':null});label.append(checkbox,node('span','Contrasté identidad y pertenencia con una fuente autorizada. Esta propuesta no es una aprobación de migración.'));card.append(label);
      }
      if(row.targetRef){const detail=targetMeta.get(row.targetRef);card.append(node('p','Destino propuesto: '+(detail.label||'Sin nombre')+' · '+(detail.organizationLabel||'Sin empresa identificada')+(detail.projectLabel?' · '+detail.projectLabel:''),'target-summary'));}
      list.append(card);
    }
    if(!list.children.length)list.append(node('p','No hay registros con estos filtros.','empty'));
    document.getElementById('summary').textContent=plan.records.filter(row=>row.action==='UNREVIEWED').length+' sin revisar · '+plan.records.filter(row=>row.action==='LINK_EXISTING').length+' propuestas · '+plan.records.filter(row=>row.action==='DEFER').length+' pendientes con motivo';
    document.getElementById('visible-count').textContent=list.querySelectorAll('article').length+' registros visibles';
  }
  for(const field of [type,status])field.onchange=render;search.oninput=render;
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  document.getElementById('export').onclick=()=>{
    const errors=problems();if(errors.length){notice.textContent=errors[0]+' Corregí el borrador antes de exportar.';return;}
    const url=URL.createObjectURL(new Blob([JSON.stringify(proposal,null,2)+'\n'],{type:'application/json'}));
    const link=node('a');link.href=url;link.download='identity-decisions.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    dirty=false;notice.textContent='Propuesta exportada sin nombres ni datos de contacto. Revalidala contra una lectura nueva antes de generar el plan de ensayo.';
  };
  document.getElementById('import').onchange=async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      if(file.size>16*1024*1024)throw new Error('size');
      const imported=JSON.parse(await file.text()),keys=Object.keys(initial.proposal);
      if(!imported||Object.keys(imported).length!==keys.length||keys.some(key=>!Object.hasOwn(imported,key)))throw new Error('shape');
      for(const key of keys.filter(key=>key!=='plan'))if(imported[key]!==initial.proposal[key])throw new Error('context');
      if(!imported.plan||Object.keys(imported.plan).length!==Object.keys(plan).length)throw new Error('shape');
      for(const key of Object.keys(plan).filter(key=>key!=='records'))if(JSON.stringify(imported.plan[key])!==JSON.stringify(initial.proposal.plan[key]))throw new Error('basis');
      if(!Array.isArray(imported.plan.records)||imported.plan.records.length!==plan.records.length)throw new Error('coverage');
      const mutable=['action','targetRef','parentSourceRef','reason'],seen=new Set();
      for(const row of imported.plan.records){
        const own=byRef.get(row?.sourceRef);if(!own||seen.has(row.sourceRef)||Object.keys(row).length!==Object.keys(own).length)throw new Error('record');seen.add(row.sourceRef);
        for(const key of Object.keys(own).filter(key=>!mutable.includes(key)))if(JSON.stringify(row[key])!==JSON.stringify(own[key]))throw new Error('changed');
        if(!Object.hasOwn(labels,row.action))throw new Error('action');
        if(row.targetRef!==null&&byTarget.get(row.targetRef)?.kind!==row.kind)throw new Error('target');
        if(row.parentSourceRef!==null){const parent=byRef.get(row.parentSourceRef);if(!parent||parent.groupRef!==row.groupRef||parent.kind!==(row.kind==='project'?'organization':'project')||row.kind==='organization')throw new Error('parent');}
        if(row.reason!==null&&row.reason!=='DOCUMENTED_MATCH'&&!Object.hasOwn(reasons,row.reason))throw new Error('reason');
        if(row.action==='UNREVIEWED'&&(row.targetRef!==null||row.parentSourceRef!==null||row.reason!==null))throw new Error('draft');
      }
      if(dirty&&!window.confirm('Cargar esta propuesta reemplaza los cambios locales sin exportar. ¿Continuar?'))return;
      for(const row of imported.plan.records)Object.assign(byRef.get(row.sourceRef),Object.fromEntries(mutable.map(key=>[key,row[key]])));
      dirty=false;render();notice.textContent='Propuesta cargada para la misma observación. No se verificó ni modificó la base desde esta hoja.';
    }catch{notice.textContent='No se cargó la propuesta: corresponde a otra observación, tiene cambios incompatibles o no es un JSON válido.';}
    finally{event.target.value='';}
  };
  render();
}
const hash=value=>createHash('sha256').update(value).digest('base64');
export function renderIdentityReview(bundle){
  const data=JSON.stringify({proposal:bundle.proposal,context:bundle.context}).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  const script=('('+evidenceReviewer.toString()+')();').replace(/\r\n?/g,'\n');
  const css=[
    '*{box-sizing:border-box}body{margin:0;background:#070c16;color:#edf3ff;font:15px/1.55 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:32px 24px 64px}header,.toolbar,.record,.privacy{background:#101a2b;border:1px solid #2a3c58;border-radius:16px;padding:24px;margin-bottom:18px}',
    '.eyebrow{font-size:11px;letter-spacing:.14em;color:#acccff;font-weight:800}h1{font-size:clamp(27px,4vw,39px);line-height:1.15;letter-spacing:-.025em;margin:12px 0}h2{font-size:21px;margin:8px 0;overflow-wrap:anywhere}p{color:#bdcbe0}.privacy{border-color:#806b39;background:#211d16;color:#f4d79a}.privacy strong{color:#ffe1a8}.privacy p{margin:8px 0;color:#d3c6ad}',
    '.toolbar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.actions{grid-column:1/-1;display:flex;gap:14px;flex-wrap:wrap;align-items:center}.toolbar label,.controls label{display:grid;gap:6px;font-size:13px;color:#c7d4e7;min-width:0}.controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}select,input,button{font:inherit;min-height:44px;min-width:0;max-width:100%;border:1px solid #446080;border-radius:9px;padding:10px;background:#0b1320;color:#eef5ff}select{width:100%}button{cursor:pointer;font-weight:750;background:#97c2ff;color:#081321}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #d1e5ff;outline-offset:3px}select:disabled,input:disabled{opacity:.58}',
    '.pill{display:inline-block;border:1px solid #355279;border-radius:99px;padding:4px 10px;font-size:12px;color:#c2dbff}.small{font-size:12px;overflow-wrap:anywhere}.muted{color:#acbdd4}.warning{background:#312412;color:#ffdcaa;padding:12px;border-radius:8px}.evidence{font-size:13px;color:#c0dfff}.source-context p{font-size:13px;color:#c6d4e9;border-left:2px solid #597fab;padding-left:12px}.attestation{display:flex;align-items:flex-start;gap:12px;margin-top:20px;font-size:13px;color:#cbd9ec}.attestation input{width:20px;height:20px;min-height:20px;flex-shrink:0}.target-summary{padding:14px;background:#162b41;border-radius:9px;color:#d9ebff;overflow-wrap:anywhere}#notice{min-height:24px;color:#cef0db}#summary{font-weight:700}footer{font-size:13px;color:#b9c9df;line-height:1.7}.empty{padding:18px}',
    '@media(max-width:640px){main{padding:18px 12px 40px}header,.toolbar,.record,.privacy{padding:18px}.controls,.toolbar{grid-template-columns:minmax(0,1fr)}.actions{display:grid;grid-template-columns:minmax(0,1fr)}select,input{font-size:16px}h2{font-size:19px}}'
  ].join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(css)}'; connect-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'"><title>ObraSaaS · Revisión de identidades</title><style>${css}</style></head><body><main>
  <header><div class="eyebrow">OBRASAAS · REVISIÓN PRIVADA DEL PASE EMPRESARIAL</div><h1>Identidades con contexto verificable</h1><p>Primero empresas, después obras y finalmente trabajadores y tareas. Compará la fuente histórica con el catálogo existente: los nombres repetidos y candidatos no equivalen a identidad confirmada.</p></header>
  <aside class="privacy"><strong>Archivo privado: contiene nombres de la fuente y del catálogo.</strong><p>Se genera localmente y no se conecta a la red. No contiene columnas de documentos, teléfonos, correos, credenciales, importes ni mensajes. No publiques ni compartas este HTML.</p><p>La exportación guarda referencias y decisiones, no nombres. La validación posterior también detecta si cambiaron los nombres mostrados.</p></aside>
  <div class="toolbar"><label>Tipo de registro<select id="kind"><option value="organization">1 · Empresas</option><option value="project">2 · Obras</option><option value="worker">3 · Trabajadores</option><option value="task">4 · Tareas</option><option value="all">Todos</option></select></label><label>Estado<select id="state"><option value="all">Todos los estados</option><option value="UNREVIEWED">Sin revisar</option><option value="LINK_EXISTING">Vínculo propuesto</option><option value="DEFER">Pendiente con motivo</option></select></label><label>Buscar por nombre o referencia<input id="search" type="search" placeholder="Empresa, obra o persona"></label><div class="actions"><button id="export" type="button">Exportar propuesta sin nombres</button><label>Cargar una propuesta guardada<input id="import" type="file" accept="application/json,.json"></label></div></div>
  <p id="summary" role="status"></p><p id="visible-count" class="muted small"></p><p id="notice" role="status" aria-live="polite"></p><section id="records" aria-label="Identidades por revisar"></section><footer>Exportar no firma ni autoriza una migración. Las pertenencias, coincidencias y cambios se comprueban nuevamente en el servidor del comando. No se escribe en la base desde este archivo.</footer><noscript>La edición requiere JavaScript local. El manifiesto conserva la propuesta sin etiquetas personales.</noscript>
  </main><script type="application/json" id="identity-data">${data}</script><script>${script}</script></body></html>`;
}
