// Shared presentation copy only. A quality pass never identifies a person.
export const CAPTURE_QUALITY_NOTICE='Antes de guardar la presentación comprobamos la calidad y el encuadre de las imágenes. Si una foto necesita corrección, te indicamos qué repetir. Si el control no está disponible, conservá las imágenes y reintentá más tarde. Estos controles no aprueban tu identidad ni comprueban que el documento sea auténtico.';
const kinds=Object.freeze({DOCUMENT_FRONT:'el frente del documento',DOCUMENT_BACK:'el dorso del documento',SELFIE:'la selfie'});
const messages=Object.freeze({
 DOCUMENT_FRAME_UNCONFIRMED:'No pudimos distinguir el documento completo. Apoyalo sobre un fondo que contraste y fotografiá sus cuatro bordes.',
 DOCUMENT_OUT_OF_FRAME:'Parte del documento quedó fuera de la foto. Incluí los cuatro bordes.',
 DOCUMENT_TOO_SMALL:'El documento se ve demasiado pequeño. Acercá la cámara sin recortar sus bordes.',
 DOCUMENT_PORTRAIT_UNCONFIRMED:'No pudimos distinguir con claridad la foto del rostro en el frente del documento. Usá el lado que tiene tu foto, acercá la cámara sin cortar los bordes y evitá reflejos.',
 FACE_OUT_OF_FRAME:'Parte del rostro quedó fuera de la foto. Centrá la cara completa.',
 FACE_TOO_SMALL:'El rostro se ve demasiado pequeño. Acercate un poco a la cámara.',
 IMAGE_BLURRED:'La imagen está desenfocada. Limpiá la lente, mantené la cámara quieta y volvé a enfocar.',
 IMAGE_DECODE_FAILED:'No pudimos abrir la imagen. Tomá una foto nueva o elegí un archivo válido.',
 IMAGE_LOW_CONTRAST:'Falta detalle en la imagen. Usá luz pareja y evitá sombras o reflejos.',
 IMAGE_TOO_BRIGHT:'La imagen tiene demasiada luz o reflejos. Cambiá el ángulo y evitá el flash directo.',
 IMAGE_TOO_DARK:'La imagen está demasiado oscura. Buscá luz de frente y volvé a tomarla.',
 IMAGE_TOO_SMALL:'La resolución es demasiado baja. Tomá una fotografía nueva con mayor tamaño.',
 QUALITY_SERVICE_UNAVAILABLE:'No pudimos completar el control de calidad. Conservá las imágenes y volvé a intentar más tarde.',
 SINGLE_FACE_REQUIRED:'Necesitamos un solo rostro visible. Sacá la selfie mirando a la cámara, sin sostener el documento ni incluir a otra persona.',
});
export function captureQualityFeedback(code){
 if(typeof code!=='string')return null;
 for(const [kind,label] of Object.entries(kinds)){const prefix='PARTICIPANT_CAPTURE_'+kind+'_';if(code.startsWith(prefix)){const reason=code.slice(prefix.length);if(reason==='DOCUMENT_PORTRAIT_UNCONFIRMED'&&kind!=='DOCUMENT_FRONT')return null;return Object.hasOwn(messages,reason)?{kind,reason,message:'Revisá '+label+'. '+messages[reason]+' La presentación todavía no se guardó.'}:null;}}
 return null;
}
export function captureQualityRejection(value,status){
 if(![422,503].includes(status)||!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!=='code|identityCertified|saved'||value.saved!==false||value.identityCertified!==false)return null;
 return captureQualityFeedback(value.code);
}
