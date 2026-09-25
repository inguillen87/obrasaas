import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { tsImport } from 'tsx/esm/api';
import { buildFieldMenuPayload } from '../src/lib/whatsapp/field-interactive-menu.js';
const {processIncomingObraMessage}=await tsImport('../src/lib/whatsapp/obra-engine.js',{parentURL:import.meta.url,tsconfig:'./jsconfig.json'});
const {normalizeMetaWebhook}=await tsImport('../src/lib/whatsapp/meta.js',{parentURL:import.meta.url,tsconfig:'./jsconfig.json'});
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/native-field-menu-ui');mkdirSync(out,{recursive:true});
const scope={organizationId:'company-fixture',projectId:'worksite-fixture',workerId:'worker-fixture',phoneNumberId:'123456789012345'};
const state={attendance:{},incidents:[],tasks:{},alertsCount:0,operariosCount:0};
let role='FOREMAN',counter=0;const errors=[],requests=[];
const html=`<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ensayo local del menú de obra</title>
<style>*{box-sizing:border-box}body{margin:0;padding:20px;font:15px Arial,sans-serif;background:#060913;color:#f8fafc}.phone{max-width:440px;margin:auto;border:1px solid #334155;border-radius:18px;padding:22px;background:#0b1120}small{color:#94a3b8;line-height:1.6}h1{font-size:23px}h2{font-size:18px}p{white-space:pre-wrap;line-height:1.6}button,input{font:inherit;min-height:46px;border-radius:10px;padding:12px;border:1px solid #334155;background:#0f172a;color:#f8fafc;width:100%;margin:6px 0}button{cursor:pointer;text-align:left}button span{display:block;font-size:13px;color:#94a3b8;margin-top:5px}button:focus-visible,input:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}.primary{background:#f59e0b;color:#060913;font-weight:700;text-align:center}.proof{border-top:1px solid #334155;margin-top:20px;padding-top:12px}#rows{display:grid;gap:5px}fieldset{border:0;padding:0;margin:18px 0}legend{font-size:18px;font-weight:700}label{font-size:13px}</style>
<main class="phone"><small>ENSAYO LOCAL · NO ES UNA ENTREGA DE WHATSAPP</small><h1>Menú nativo de obra</h1><h2 id="title"></h2><p id="reply" role="status"></p><button id="open" class="primary" hidden>Elegir opción</button><fieldset id="choices" hidden><legend>Opciones autorizadas</legend><div id="rows"></div></fieldset><small id="footer"></small><form id="form"><label for="text">Mensaje de ensayo</label><input id="text" maxlength="500" placeholder="menú o descripción de la incidencia"><button class="primary" type="submit">Enviar mensaje de ensayo</button></form><p class="proof" id="effects"></p></main>
<script type="module">
const byId=id=>document.getElementById(id);let pending=false;
async function send(input){if(pending)return;pending=true;try{const r=await fetch('/fixture/step',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const data=await r.json();if(!r.ok)throw Error('No se confirmó el ensayo');render(data);}finally{pending=false;}}
function render(data){byId('reply').textContent=data.reply;byId('rows').replaceChildren();byId('choices').hidden=true;byId('open').hidden=!data.message;byId('title').textContent=data.message?.interactive.header.text||'Respuesta del motor';byId('footer').textContent=data.message?.interactive.footer.text||'';for(const row of data.message?.interactive.action.sections[0].rows||[]){const b=document.createElement('button');b.type='button';b.dataset.id=row.id;const label=document.createElement('strong');label.textContent=row.title;const desc=document.createElement('span');desc.textContent=row.description;b.append(label,desc);b.addEventListener('click',()=>send({selection:b.dataset.id,title:row.title}));byId('rows').append(b);}byId('effects').textContent='Incidentes registrados en el ensayo: '+data.incidents+' · Fichajes: '+data.attendance;}
byId('open').onclick=()=>{byId('choices').hidden=false;byId('rows').querySelector('button')?.focus();};byId('form').onsubmit=e=>{e.preventDefault();void send({text:byId('text').value});byId('text').value='';};void send({text:'menú'});
</script></html>`;
const server=createServer((req,res)=>{
  if(req.url!=='/fixture/step'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);return;}
  let body='';req.on('data',chunk=>body+=chunk);req.on('end',async()=>{
    try {
      const input=JSON.parse(body);requests.push(input);const timestamp=String(Math.floor(Date.now()/1000));
      const message={id:'wamid.local-menu-'+ ++counter,from:'15551230001',timestamp,
        ...(input.selection?{type:'interactive',interactive:{type:'list_reply',list_reply:{id:input.selection,title:input.title}}}:{type:'text',text:{body:input.text}})};
      const [event]=normalizeMetaWebhook({object:'whatsapp_business_account',entry:[{id:'waba-fixture',changes:[{field:'messages',value:{metadata:{phone_number_id:scope.phoneNumberId},messages:[message]}}]}]});
      const result=await processIncomingObraMessage(event,scope,{persist:false,state,prisma:{},projectSettings:{id:scope.projectId,organizationId:scope.organizationId,name:'Obra Norte · ensayo',timezone:'America/Argentina/Buenos_Aires'},worker:{id:scope.workerId,projectId:scope.projectId,name:'Participante de ensayo',active:true,metadata:{whatsappRole:role}}});
      const payload=result.fieldMenu?buildFieldMenuPayload({to:event.from,scope:result.fieldMenu,section:result.fieldMenu.section,role,projectName:'Obra Norte · ensayo',replyToMessageId:event.externalId}):null;
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({reply:payload?payload.interactive.body.text:result.reply,message:payload,incidents:state.incidents.length,attendance:Object.keys(state.attendance).length}));
    } catch(error){errors.push(error.message);res.statusCode=500;res.end('{"error":"Ensayo no confirmado"}');}
  });
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:1000}});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);
  await expect(page.getByRole('button',{name:'Elegir opción',exact:true})).toBeVisible();assert.equal(state.incidents.length,0);
  await page.getByRole('button',{name:'Elegir opción',exact:true}).click();await page.getByRole('button',{name:/^Mi jornada/}).click();
  await expect(page.getByRole('heading',{name:'Tu jornada en esta obra',exact:true})).toBeVisible();assert.equal(Object.keys(state.attendance).length,0);
  await page.getByRole('button',{name:'Elegir opción',exact:true}).click();await expect(page.getByRole('button',{name:/^Registrar ingreso/})).toBeVisible();await expect(page.getByRole('button',{name:/^Registrar salida/})).toBeVisible();
  await page.getByRole('button',{name:/^Volver al menú/}).click();await expect(page.getByRole('heading',{name:'Menú de la obra',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Elegir opción',exact:true}).click();
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:1100});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    if(width===390||width===1280)await page.screenshot({path:resolve(out,'native-menu-'+width+'.png'),fullPage:true});
  }
  role='SAFETY';await page.getByRole('button',{name:/^Proponer avance/}).click();await expect(page.getByRole('status')).toContainText('acceso actual');
  assert.equal(state.incidents.length,0);assert.deepEqual(state.tasks,{});
  async function text(value){await page.getByLabel('Mensaje de ensayo').fill(value);await page.getByRole('button',{name:'Enviar mensaje de ensayo',exact:true}).click();}
  await text('menú');await expect(page.getByRole('heading',{name:'Menú de la obra',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Elegir opción',exact:true}).click();await expect(page.getByRole('button',{name:/^Proponer avance/})).toHaveCount(0);
  await page.getByRole('button',{name:/^Informar incidente/}).click();await expect(page.getByRole('status')).toContainText('Contame qué ocurrió');assert.equal(state.incidents.length,0);
  await text('incidencia urgente: pérdida de agua en planta baja');await expect(page.locator('#effects')).toContainText('Incidentes registrados en el ensayo: 1');
  assert.equal(state.incidents.length,1);assert.deepEqual(state.tasks,{});assert.deepEqual(state.attendance,{});assert.deepEqual(errors,[]);
  const proof={result:'PASS',environment:'local-provider-payload-renderer-real-normalizer-and-message-engine-controlled-state',nativePayloadShape:true,roleFilteredMenu:true,journeyNavigationWithoutCheckIn:true,staleRoleOptionDenied:true,incidentPromptThenRecord:true,widths:[320,390,768,1280],pageErrors:0,localRequests:requests.length,externalMetaCalls:0};
  writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
