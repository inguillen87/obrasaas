// Whole-message language classification only: never a name parser or authority.
// Commands and greetings with extra words retain their existing exact handling.
const greetingBodies=new Set(['HOLA','HOLA BUENAS','HOLA, BUENAS','BUENAS','BUEN DIA','BUEN DÍA','BUENOS DIAS','BUENOS DÍAS','BUENAS TARDES','BUENAS NOCHES']);
export function isMetaGreeting(body){
 if(typeof body!=='string'||body.length>80)return false;
 const normalized=body.trim().replace(/^[¡!¿?.,]+|[¡!¿?.,]+$/g,'').trim().replace(/\s+/g,' ').toUpperCase();
 return greetingBodies.has(normalized);
}
