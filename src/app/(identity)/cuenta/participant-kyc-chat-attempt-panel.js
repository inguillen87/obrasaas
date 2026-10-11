'use client';
import {useEffect,useRef,useState} from 'react';
import {participantKycChatAttemptView,participantKycChatAttemptDate} from './participant-kyc-chat-attempt-view.mjs';
import styles from './participant-panel.module.css';

export function ParticipantKycChatAttemptPanel({projectId,scope,workerId,challengeId,api,onDenied,disabled}){
 const [result,setResult]=useState(null),[busy,setBusy]=useState(false),epoch=useRef(0),alive=useRef(true);
 useEffect(()=>{alive.current=true;epoch.current++;return()=>{alive.current=false;};},[]);
 async function consult(){
  if(disabled||busy)return;const current=++epoch.current;setBusy(true);setResult(null);
  try{
   const value=await api({projectId,scope,detail:'kyc-chat-attempt',workerId,challengeId},{},'/api/identity/participants',false,value=>participantKycChatAttemptView(value,{projectId,scope,workerId,challengeId}));
   if(alive.current&&current===epoch.current)setResult(value);
  }catch(error){if(alive.current&&current===epoch.current){if(!onDenied(error))setResult({state:'UNAVAILABLE',description:'No se pudo comprobar el intento. La consulta conserva el código y la presentación vigentes.'});}}
  finally{if(alive.current&&current===epoch.current)setBusy(false);}
 }
 return <div className={styles.chatStatus} data-kyc-chat-attempt aria-busy={busy}><button type="button" disabled={disabled||busy} onClick={consult}>{busy?'Consultando intento…':'Consultar último intento de identidad'}</button>{result&&<div role="status" aria-live="polite"><p>{result.description}</p>{result.receivedAt&&<p>Mensaje comprobado: {participantKycChatAttemptDate(result.receivedAt)}.</p>}{result.checks&&<details className={styles.options}><summary>Comprobaciones del mensaje</summary><p>Formato del código: {result.checks.codeSyntax?'correcto':'no coincide'}. Código vigente: {result.checks.codeMatch?'coincide':'no coincide'}. Teléfono registrado: {result.checks.senderMatch?'coincide':'no coincide'}. Recibo de preparación: {result.checks.preparationReceiptMatch?'comprobado':'sin confirmar'}.</p></details>}</div>}</div>;
}
