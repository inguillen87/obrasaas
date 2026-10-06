const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const prerequisites=[
 ['app','Aplicación de ObraSaaS'],
 ['secret','Autorización privada de la plataforma'],
 ['configuration','Recorrido de autorización en Meta'],
 ['version','Versión compatible de Meta'],
 ['vault','Protección de las credenciales'],
 ['review','Alta de clientes habilitada por la plataforma'],
 ['callback','Recepción de eventos de Meta'],
];
const invalid=()=>Object.assign(new Error('No pudimos comprobar la preparación de Meta. Conservamos el intento; usá Comprobar estado antes de continuar.'),{code:'META_CUSTOMER_READINESS_RESPONSE_INVALID'});

// Validate the existing public readiness contract before displaying it. These
// configuration gates never attest to Meta's business review or App Review.
export function metaOnboardingSnapshot(result,{scope,projectId}){
 if(!object(result))throw invalid();
 if(result.scope!==scope||result.projectId!==projectId)throw Object.assign(new Error('La respuesta pertenece a otra obra.'),{code:'WORKSPACE_CONTEXT_CHANGED'});
 const r=result.readiness,keys=prerequisites.map(([key])=>key);
 if(!object(r)||!object(r.gates)||Object.keys(r.gates).sort().join('|')!==keys.slice().sort().join('|')||keys.some(key=>typeof r.gates[key]!=='boolean')||typeof r.canLaunchMeta!=='boolean'||r.canLaunchMeta!==keys.every(key=>r.gates[key])||r.operational!==false)throw invalid();
 const recovery=r.recovery;
 if(!object(recovery)||recovery.afterResponse!==true||typeof recovery.signedJob!=='boolean'||typeof recovery.periodic!=='boolean'||recovery.intervalMinutes!==5||recovery.productionVerified!==false||r.humanAcceptance!=='NOT_VERIFIED'||r.numberRegistration!=='REQUIRES_CUSTOMER_NUMBER')throw invalid();
 if(typeof result.prepared!=='boolean'||!['DEDICATED','BUSINESS_APP','EXISTING_API',null].includes(result.numberMode)||typeof result.companyName!=='string'||typeof result.projectName!=='string')throw invalid();
 return result;
}

export function metaOnboardingReadinessView(result){
 const readiness=result.readiness,signup=result.signup,connection=result.connection;
 const configured=readiness.canLaunchMeta,assisted=result.prepared&&result.numberMode!=='DEDICATED';
 const uncertain=signup&&['EXCHANGE_STARTED','EXCHANGE_UNKNOWN','VERIFYING','REGISTRATION_VERIFYING','REGISTRATION_STARTED','REGISTRATION_UNKNOWN'].includes(signup.state);
 let next=result.prepared?'Consultá las condiciones de plataforma antes de autorizar el número.':'Guardá la preparación de WhatsApp para esta empresa y obra.';
 if(!result.prepared)next='Guardá la preparación de WhatsApp para esta empresa y obra.';
 else if(assisted)next='La coexistencia o el traspaso necesita revisión específica. La preparación queda guardada; continuá trabajando desde la web.';
 else if(result.prepared&&!configured)next='El equipo de ObraSaaS debe completar las condiciones de plataforma pendientes. Podés continuar con tu empresa y obra desde la web.';
 else if(uncertain)next='Comprobá el estado del mismo intento antes de continuar. Un resultado incierto no habilita repetir el canje o el registro.';
 else if(signup?.registrationRequired)next='Revisá el número en Meta y completá su registro con tu confirmación y el PIN de seguridad.';
 else if(signup?.state==='PREPARED')next='Elegí Autorizar en Meta y completá el recorrido oficial con un responsable de los activos.';
 else if(signup?.canReconcile&&signup.state!=='LINKED_PENDING_ACCEPTANCE')next='Usá Recuperar conexión para comprobar la autorización y el registro existentes.';
 else if(configured&&!connection)next='Elegí Preparar autorización. Después, un responsable completa Autorizar en Meta.';
 else if(connection&&!result.activation?.operational)next='Consultá Operación del canal y su confirmación antes de habilitarlo.';
 else if(result.activation?.operational)next='El canal está habilitado. La recepción, respuesta, entrega y el recorrido con participantes necesitan una prueba real.';
 const catalog=result.templates,consulted=object(catalog)&&Array.isArray(catalog.items)&&typeof catalog.observedAt==='string'&&Number.isFinite(Date.parse(catalog.observedAt));
 const approved=consulted?catalog.items.filter(item=>item?.status==='APPROVED').length:0;
 const registered=signup?.state==='LINKED_PENDING_ACCEPTANCE';
 return {
  next,
  steps:[
   {key:'preparation',title:'Preparación de esta obra',state:result.prepared?'Guardada':'Pendiente',detail:result.prepared?'El nombre del asistente y los circuitos están guardados.':'Prepará el asistente, el tipo de número y los circuitos.'},
   {key:'platform',title:'Alta de clientes',state:configured?'Disponible para autorizar':'Pendiente de plataforma',detail:configured?'La configuración permite abrir el recorrido de Meta. Cada empresa debe autorizar sus propios activos.':'Revisá las condiciones pendientes con el equipo de ObraSaaS.'},
   {key:'business',title:'Revisión del negocio en Meta',state:'No comprobada aquí',detail:'Consultá el estado del negocio y los requisitos que Meta solicite. Si indica En revisión, esperá su resultado; podés seguir trabajando desde la web.'},
   {key:'number',title:'Conexión y registro del número',state:registered?'Registro confirmado · prueba pendiente':signup?.registrationRequired?'Registro pendiente':connection?'Conexión guardada · comprobar registro':'Sin conexión confirmada',detail:registered?'El registro no confirma recepción, respuesta o entrega.':'El código de SMS o llamada y el PIN de registro son pasos distintos. Consultá el intento y la conexión antes de repetir.'},
   {key:'templates',title:'Plantillas de esta cuenta',state:consulted?'Catálogo consultado':'Sin catálogo comprobado',detail:consulted?`${approved} ${approved===1?'plantilla aprobada':'plantillas aprobadas'} en el catálogo consultado. La aprobación no acredita un envío ni su entrega.`:'Consultá las plantillas de la cuenta vinculada. La aprobación corresponde a cada mensaje e idioma.'},
   {key:'activation',title:'Operación del canal',state:result.activation?.operational===true?'Canal habilitado':'Pendiente de habilitación',detail:'La habilitación requiere la comprobación y confirmación del administrador. Cada participante conserva sus propios permisos y vínculo.'},
   {key:'acceptance',title:'Prueba con participantes',state:'Sin aceptar',detail:'Comprobá recepción, respuesta y entrega en teléfonos reales, además de los accesos y el recorrido de dos participantes con roles distintos.'},
  ],
  prerequisites:prerequisites.map(([key,title])=>({key,title,state:readiness.gates[key]?'Configurada':'Pendiente'})),
  recovery:{state:readiness.recovery.signedJob&&readiness.recovery.periodic?'Configurada · ejecución por comprobar':'Configuración pendiente',detail:'Esta consulta muestra la configuración de recuperación. Su ejecución y los resultados reales se comprueban por separado.'},
 };
}
