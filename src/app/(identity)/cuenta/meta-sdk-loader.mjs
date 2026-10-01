const sdkLoads=new WeakMap();
const failure=()=>new Error('No se pudo abrir Meta. La preparación se conserva. Usá Reintentar acceso a Meta para volver a cargarlo.');

// Loading the SDK never opens a login window or sends an authorization code.
export function loadCustomerMetaSdk(config,{windowObject=window,documentObject=document,schedule=setTimeout,unschedule=clearTimeout,timeoutMs=15000}={}){
 const key=`${config.appId}:${config.version}`,previousLoad=sdkLoads.get(windowObject);
 if(previousLoad?.key===key)return previousLoad.promise;
 if(previousLoad&&!previousLoad.settled)return Promise.reject(failure());
 let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const attempt={key,promise,settled:false};sdkLoads.set(windowObject,attempt);
 let script,timer,asyncInit,errorHandler,previousError;
 const previousInit=windowObject.fbAsyncInit;
 function settle(error){
  if(attempt.settled)return;attempt.settled=true;
  if(timer!==undefined)unschedule(timer);
  if(windowObject.fbAsyncInit===asyncInit)windowObject.fbAsyncInit=previousInit;
  if(script&&script.onerror===errorHandler)script.onerror=previousError||null;
  if(error){if(script?.id==='customer-meta-sdk')script.remove();sdkLoads.delete(windowObject);reject(failure());}
  else resolve(windowObject.FB);
 }
 function initialize(){
  try{if(typeof windowObject.FB?.init!=='function'||typeof windowObject.FB?.login!=='function')throw failure();
   windowObject.FB.init({appId:config.appId,version:config.version,autoLogAppEvents:false,xfbml:false});settle();
  }catch(error){settle(error);}
 }
 if(windowObject.FB){initialize();return promise;}
 asyncInit=()=>{if(attempt.settled)return;try{previousInit?.();initialize();}catch(error){settle(error);}};
 windowObject.fbAsyncInit=asyncInit;
 timer=schedule(()=>settle(failure()),timeoutMs);
 try{
  script=documentObject.getElementById('customer-meta-sdk');
  const created=!script;
  if(created){script=documentObject.createElement('script');script.id='customer-meta-sdk';script.src='https://connect.facebook.net/es_LA/sdk.js';script.async=true;script.defer=true;}
  previousError=script.onerror;errorHandler=()=>settle(failure());script.onerror=errorHandler;
  if(created)documentObject.body.appendChild(script);
 }catch(error){settle(error);}
 return promise;
}
