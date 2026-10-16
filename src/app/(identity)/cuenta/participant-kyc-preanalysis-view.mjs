const messages={
 QUEUED:['Análisis automático pendiente','La presentación quedó guardada. El análisis comenzará con las autorizaciones que elegiste; no hace falta solicitarlo de nuevo.'],
 RUNNING:['Análisis automático en curso','Estamos procesando las imágenes autorizadas. Actualizá la ficha para consultar el resultado.'],
 WAITING_CONFIGURATION:['Análisis pendiente de configuración','El servicio de análisis todavía no está disponible. Las imágenes permanecen guardadas para su revisión.'],
 USAGE_HELD:['Análisis pendiente de comprobación','Hay una consulta registrada que necesita comprobación. Conservamos la presentación y evitamos repetir esa consulta.'],
 EXTRACTED_UNVERIFIED:['Lectura automática preparada','Los datos leídos del documento están disponibles para el responsable. Debe contrastarlos con las imágenes originales.'],
 ADVISORY_UNREVIEWED:['Comparación facial preparada','El responsable puede consultar las señales orientativas junto con las imágenes originales.'],
 FAILED_RETRYABLE:['No se completó el análisis automático','Conservamos las imágenes y la revisión manual sigue disponible.'],
 UNCERTAIN:['Resultado del análisis por confirmar','Una consulta sigue sin resultado confirmado y no se repetirá automáticamente. Los demás pasos autorizados conservan su seguimiento.'],
 SKIPPED_CONSENT:['Presentación lista para revisión manual','No se iniciaron los análisis automáticos opcionales. El responsable puede revisar las imágenes presentadas.'],
};
const issueMessages={
 OCR_NOT_AUTHORIZED:'Lectura del documento: sin autorización.',
 FACIAL_NOT_AUTHORIZED:'Comparación facial: sin autorización.',
 OCR_UNAVAILABLE:'Lectura del documento: servicio no disponible.',
 FACIAL_UNAVAILABLE:'Comparación facial: servicio no disponible.',
 OCR_USAGE_HELD:'Lectura del documento: hay una consulta anterior por comprobar.',
 DOCUMENT_TEXT_UNCONFIRMED:'No se pudo confirmar el texto del documento.',
 FACIAL_RESULT_UNCONFIRMED:'No se confirmó la comparación facial.',
 OCR_DISPATCH_UNCERTAIN:'El envío para lectura está registrado; falta confirmar el resultado.',
 FACIAL_DISPATCH_UNCERTAIN:'El envío para comparación facial está registrado; falta confirmar el resultado.',
 CUIL_NOT_READ:'El CUIL no se pudo leer. Comprobalo por separado si lo necesitás.',
};

// This is a view of the server's public projection, never an admission decision.
// Provider codes, extracted private fields and scores do not enter its copy.
export function participantKycPreanalysisView(kyc){
 const processing=kyc?.processing;
 if(processing?.automatic!==true)return null;
 const reviewed=['APPROVED','REJECTED'].includes(kyc.status)&&['QUEUED','RUNNING','WAITING_CONFIGURATION','USAGE_HELD'].includes(processing.status);
 const copy=reviewed?['Presentación ya revisada','Hay una decisión registrada sobre esta presentación. El resultado del análisis anterior sigue sin confirmar.']:Object.hasOwn(messages,processing.status)?messages[processing.status]:null;
 const issues=Array.isArray(processing.issueCodes)?[...new Set(processing.issueCodes.filter(code=>typeof code==='string'&&Object.hasOwn(issueMessages,code)))].map(code=>issueMessages[code]):[];
 return {state:reviewed?'REVIEWED_WITHOUT_ANALYSIS_RESULT':copy?processing.status:'UNCONFIRMED',title:copy?.[0]||'Estado del análisis por confirmar',description:copy?.[1]||'Actualizá la ficha para comprobar el estado de esta presentación.',issues,notice:'El análisis no aprueba la identidad ni habilita permisos de trabajo.'};
}

// Historical manual presentations retain their existing route. An automatic
// intent, including an unknown state, must never offer a duplicate dispatch.
export function participantKycManualAnalysisAvailable(kyc){
 return kyc?.processing?.automatic!==true&&!['RUNNING','EXTRACTED_UNVERIFIED','ADVISORY_UNREVIEWED'].includes(kyc?.processing?.status);
}

// The server projects fields to a reviewer only after OCR completes. A second
// stage waiting or remaining uncertain must not hide that partial result.
export function participantKycExtractionVisible(kyc,canManage){
 return canManage===true&&Boolean(kyc?.processing?.fields)&&(kyc.processing.status==='EXTRACTED_UNVERIFIED'||kyc.processing.automatic===true);
}
