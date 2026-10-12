'use client';
import {useEffect,useRef,useState} from 'react';
import {participantKycChatAttemptView,participantKycChatAttemptDate} from './participant-kyc-chat-attempt-view.mjs';
import styles from './participant-panel.module.css';

export function ParticipantKycChatAttemptPanel(props){return <AttemptInner key={props.projectId+':'+props.scope+':'+props.workerId+':'+props.challengeId} {...props}/>;}
function AttemptInner({projectId,scope,workerId,challengeId,api,onDenied,disabled}){
 const [result,setResult]=useState(null),[busy,setBusy]=useState(false),epoch=useRef(0),alive=useRef(true);
 useEffect(()=>{alive.current=true;epoch.current++;return()=>{alive.current=false;};},[]);
 async function consult(){
  if(disabled||busy)return;const current=++epoch.current;setBusy(true);setResult(null);
  try{
   const value=await api({projectId,scope,detail:'kyc-chat-attempt',workerId,challengeId},{},'/api/identity/participants',false,value=>participantKycChatAttemptView(value,{projectId,scope,workerId,challengeId}));
   if(alive.current&&current===epoch.current)setResult(value);
  }catch(error){if(alive.current&&current===epoch.current){if(!onDenied?.(error))setResult({state:'UNAVAILABLE',description:'No se pudo comprobar el intento. La consulta conserva la presentación vigente.'});}}
  finally{if(alive.current&&current===epoch.current)setBusy(false);}
 }
 const feedback=result?.replyDelivery;
 return <div className={styles.chatStatus} data-kyc-chat-attempt aria-busy={busy}><button type="button" disabled={disabled||busy} onClick={consult}>{busy?'Consultando intento…':'Consultar último intento de identidad'}</button>{result&&<div role="status" aria-live="polite" aria-atomic="true"><ol aria-label="Intento, respuesta y entrega" style={{paddingLeft:20,minWidth:0}}>
  <li><strong>{result.state==='OBSERVED'?'Intento recibido':'Intento por comprobar'}</strong><p>{result.description}</p>{result.receivedAt&&<p>Mensaje comprobado: <time dateTime={result.receivedAt}>{participantKycChatAttemptDate(result.receivedAt)}</time>.</p>}{result.checks&&<details className={styles.options}><summary>Comprobaciones del mensaje</summary><p>Formato del código: {result.checks.codeSyntax?'correcto':'no coincide'}. Código vigente: {result.checks.codeMatch?'coincide':'no coincide'}. Teléfono registrado: {result.checks.senderMatch?'coincide':'no coincide'}. Recibo de preparación: {result.checks.preparationReceiptMatch?'comprobado':'sin confirmar'}.</p></details>}</li>
  <li data-kyc-attempt-response={feedback?.state||'UNAVAILABLE'}><strong>Respuesta</strong><p>{feedback?.response.label||'Sin comprobación'}. {feedback?.response.description||'No se pudo comprobar la respuesta de este intento.'}</p>{feedback?.recordedAt&&feedback.dateSource==='SERVER'&&<p>Registro de la respuesta: <time dateTime={feedback.recordedAt}>{participantKycChatAttemptDate(feedback.recordedAt)}</time>.</p>}</li>
  <li data-kyc-attempt-delivery={feedback?.state||'UNAVAILABLE'}><strong>Entrega</strong><p>{feedback?.delivery.label||'Sin comprobación'}. {feedback?.delivery.description||'Todavía no hay confirmación de entrega al teléfono.'}</p>{feedback?.recordedAt&&feedback.dateSource==='WHATSAPP'&&<p>Fecha informada por WhatsApp: <time dateTime={feedback.recordedAt}>{participantKycChatAttemptDate(feedback.recordedAt)}</time>.</p>}</li>
 </ol><p>La presentación de identidad conserva su revisión independiente.</p></div>}</div>;
}
