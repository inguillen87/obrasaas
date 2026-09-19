import { createHash } from 'node:crypto';
import { FIELD_WORKER_INTENTS as I, canFieldWorkerHandleIntent } from '../field-workers.js';

const PREFIX = 'obrasaas-menu:v1:';
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/.test(value);
const ROLE_NAMES = { WORKER:'Operario', FOREMAN:'Capataz', SITE_MANAGER:'Responsable de obra', SAFETY:'Seguridad e higiene' };
const options = Object.freeze([
  { key:'JOURNEY', section:'MAIN', title:'Mi jornada', description:'Ingreso, pausa, regreso y salida', intent:I.ATTENDANCE_START,
    guidance:'Elegí una acción de jornada. Ingreso y salida requieren la ubicación que pide el circuito seguro.' },
  { key:'EVIDENCE', section:'MAIN', title:'Enviar evidencia', description:'Foto o archivo con una descripción', intent:I.EVIDENCE,
    guidance:'Adjuntá una foto, video o archivo e indicá qué muestra, el sector y la tarea. Se conserva como evidencia; no certifica avance automáticamente.' },
  { key:'INCIDENT', section:'MAIN', title:'Informar incidente', description:'Sector, descripción y riesgo observado', intent:I.INCIDENT, command:'incidencia' },
  { key:'PROGRESS', section:'MAIN', title:'Proponer avance', description:'Propuesta revisable ligada a una tarea', intent:I.TASK_PROGRESS,
    guidance:'Indicá la tarea real y el porcentaje observado, por ejemplo: avance 30% tarea 12. Se prepara una propuesta; el Gantt no se modifica por elegir esta opción.' },
  { key:'DELAY', section:'MAIN', title:'Informar demora', description:'Tarea, motivo y plazo estimado', intent:I.DELAY_REPORT,
    guidance:'Describí la demora con la tarea, el motivo y el plazo estimado. Empezá el mensaje con «demora:». El responsable revisará el impacto en el cronograma.' },
  { key:'PAYMENT_DATA', section:'MAIN', title:'Mis datos de cobro', description:'Formulario privado; no realiza pagos', intent:I.PAYMENT_DESTINATION, command:'datos de cobro' },
  { key:'MEDICAL', section:'MAIN', title:'Licencia o certificado', description:'Usar el circuito médico privado', intent:I.MEDICAL, command:'licencia' },
  { key:'CHECK_IN', section:'JOURNEY', title:'Registrar ingreso', description:'Solicitar verificación de ingreso y GPS', intent:I.ATTENDANCE_START, command:'fichar' },
  { key:'BREAK_START', section:'JOURNEY', title:'Iniciar pausa', description:'Registrar la pausa de tu jornada', intent:I.ATTENDANCE_START, command:'almuerzo' },
  { key:'BREAK_END', section:'JOURNEY', title:'Retomar jornada', description:'Finalizar tu pausa actual', intent:I.ATTENDANCE_START, command:'volví' },
  { key:'CHECK_OUT', section:'JOURNEY', title:'Registrar salida', description:'Solicitar salida con ubicación puntual', intent:I.ATTENDANCE_START, command:'chau' },
  { key:'HOME', section:'JOURNEY', title:'Volver al menú', description:'Opciones autorizadas de esta obra', intent:I.HELP, command:'menú' },
].map(Object.freeze));
const scopeKeys = ['organizationId','projectId','workerId','phoneNumberId'];
export class FieldMenuError extends Error {
  constructor(code = 'WHATSAPP_FIELD_MENU_INVALID') { super('El menú no corresponde al contexto autorizado.'); this.code=code; }
}
export function normalizeFieldMenuDescriptor(value) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 || !['MAIN','JOURNEY'].includes(value.section)
    || Object.keys(value).length !== 6 || !scopeKeys.every(key=>identifier(value[key]))) throw new FieldMenuError();
  return { version:1, section:value.section, ...Object.fromEntries(scopeKeys.map(key=>[key,value[key]])) };
}
function contextKey(scope) {
  if (!scopeKeys.every(key=>identifier(scope?.[key]))) throw new FieldMenuError();
  return createHash('sha256').update(JSON.stringify(['obrasaas-field-menu-v1',...scopeKeys.map(key=>scope[key])])).digest('hex').slice(0,32);
}
export function fieldMenuRows({ scope, role, section = 'MAIN' }) {
  const key = contextKey(scope);
  if (!['MAIN','JOURNEY'].includes(section) || !canFieldWorkerHandleIntent(role,I.HELP)) throw new FieldMenuError();
  return options.filter(option=>option.section===section && canFieldWorkerHandleIntent(role,option.intent))
    .map(option=>({ id:PREFIX+key+':'+option.key, title:option.title, description:option.description }));
}
export function resolveFieldMenuSelection(event, { scope, role }) {
  if (!['list','button'].includes(event?.interactive?.type)) return null;
  const id = event.interactive.id;
  if (typeof id !== 'string' || !id.startsWith('obrasaas-menu:')) {
    return event.interactive.type === 'list' ? { allowed:false, code:'WHATSAPP_FIELD_MENU_UNKNOWN' } : null;
  }
  if (event.provider !== 'meta' || event.kind !== 'interactive' || event.media || event.location || event.attendanceAction || event.transcription) return { allowed:false, code:'WHATSAPP_FIELD_MENU_INVALID' };
  const expected = PREFIX+contextKey(scope)+':';
  const option = id.startsWith(expected) ? options.find(item=>item.key === id.slice(expected.length)) : null;
  if (!option || !canFieldWorkerHandleIntent(role,option.intent)) return { allowed:false, code:'WHATSAPP_FIELD_MENU_UNAUTHORIZED' };
  return { allowed:true, key:option.key, intent:option.intent, command:option.command || '', guidance:option.guidance || null, section:option.key==='JOURNEY'?'JOURNEY':'MAIN' };
}
export function buildFieldMenuPayload({ to, scope, role, section = 'MAIN', projectName, replyToMessageId }) {
  const recipient=typeof to==='string'?to.replace(/^\+/,''):'';
  if (!/^\d{8,20}$/.test(recipient)) throw new FieldMenuError();
  const rows=fieldMenuRows({scope,role,section});
  if (!rows.length || rows.length>10) throw new FieldMenuError();
  const project=typeof projectName==='string'?projectName.replace(/[\u0000-\u001f\u007f*_~`]/g,' ').trim().slice(0,120):'';
  return {
    messaging_product:'whatsapp', recipient_type:'individual', to:recipient, type:'interactive',
    ...(replyToMessageId?{context:{message_id:replyToMessageId}}:{}),
    interactive:{
      type:'list',
      header:{type:'text',text:section==='JOURNEY'?'Tu jornada en esta obra':'Menú de la obra'},
      body:{text:`${project || 'Obra actual'} · ${ROLE_NAMES[role]}\nElegí una opción. La acción vuelve a validar tus permisos; ingreso y salida conservan la verificación de ubicación.`},
      footer:{text:'Sólo para este participante y esta obra'},
      action:{button:'Elegir opción',sections:[{title:section==='JOURNEY'?'Acciones de jornada':'Trabajo de campo',rows}]},
    },
  };
}
export function assertFieldMenuPayload(payload, to) {
  const recipient=typeof to==='string'?to.replace(/^\+/,''):'';
  const interactive=payload?.interactive, sections=interactive?.action?.sections;
  if (payload?.messaging_product!=='whatsapp' || payload.recipient_type!=='individual' || payload.type!=='interactive'
    || payload.to!==recipient || !/^\d{8,20}$/.test(recipient) || interactive?.type!=='list'
    || !Array.isArray(sections) || sections.length!==1 || !Array.isArray(sections[0].rows)
    || sections[0].rows.length<1 || sections[0].rows.length>10) throw new FieldMenuError();
  const text=(value,max)=>typeof value==='string' && value.length>0 && value.length<=max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
  if (interactive.header?.type!=='text' || !text(interactive.header.text,60) || !text(interactive.body?.text,1024)
    || !text(interactive.footer?.text,60) || !text(interactive.action.button,20) || !text(sections[0].title,24)) throw new FieldMenuError();
  const rows=sections[0].rows;
  if (new Set(rows.map(row=>row.id)).size!==rows.length || rows.some(row=>!text(row.title,24) || !text(row.description,72)
    || !/^obrasaas-menu:v1:[a-f0-9]{32}:[A-Z_]+$/.test(row.id))) throw new FieldMenuError();
  return payload;
}
