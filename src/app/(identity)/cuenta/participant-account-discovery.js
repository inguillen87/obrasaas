'use client';
import {useEffect,useRef,useState} from 'react';
import {participantAccountPage,participantAccountSearch,participantAccountReadDenied} from './participant-account-discovery-format.mjs';
import styles from './participant-panel.module.css';

export function ParticipantAccountDetails({account,assignment=false}){
 return <><strong>{account.name}{account.self===true?' · Tu cuenta':''}</strong><p>{account.email||'Sin correo declarado'} · Rol vigente: {account.roleLabel}</p><p>{account.roleScope}</p>{account.self===true&&<p>Es la cuenta con la que estás ingresando.{assignment===true&&' Vincularla conserva su rol de empresa; la identidad de esta ficha continúa pendiente de revisión.'}</p>}</>;
}

export function ParticipantAccountDiscovery({projectId,scope,snapshot,api,disabled,mode='office',selectedAccount=null,selectedId='',onSelect,onInvalidate,onDenied,onPending}){
 const [query,setQuery]=useState(''),[page,setPage]=useState(()=>({accountQuery:'',existingAccounts:snapshot.existingAccounts||[],nextAccountCursor:snapshot.nextAccountCursor||null,existingAccountsTruncated:snapshot.existingAccountsTruncated===true})),[pending,setPending]=useState(false),[notice,setNotice]=useState(''),[laterPage,setLaterPage]=useState(false);
 const request=useRef({epoch:0,controller:null}),alive=useRef(true);
 useEffect(()=>{alive.current=true;const owned=request.current;return()=>{alive.current=false;owned.epoch++;owned.controller?.abort();onPending?.(false);};},[onPending]);
 const changed=query.normalize('NFC').trim()!==page.accountQuery;
 function invalidate(){request.current.epoch++;request.current.controller?.abort();request.current.controller=null;setPending(false);onPending?.(false);onInvalidate();}
 function changeQuery(value){invalidate();setQuery(value);setNotice('');}
 async function search(afterAccount=null,searchValue=query){
  if(disabled)return;let canonical;try{canonical=participantAccountSearch(searchValue);}catch(error){setNotice(error.message);return;}
  invalidate();const owned=request.current,current=owned.epoch,controller=new AbortController();owned.controller=controller;setPending(true);onPending?.(true);setNotice('Consultando cuentas…');
  try{
   const value=await api({projectId,scope,detail:'existing-accounts',query:canonical,...(afterAccount?{afterAccount}:{})},{signal:controller.signal},undefined,false,value=>participantAccountPage(value,{scope,projectId,query:canonical}));
   if(!alive.current||current!==owned.epoch)return;setPage(value);setQuery(canonical);setLaterPage(Boolean(afterAccount));setNotice(value.existingAccounts.length?'Lista vigente. Elegí la cuenta que corresponde.':'No encontramos cuentas vigentes con esta búsqueda. Probá otro nombre o correo.');
  }catch(error){if(!alive.current||current!==owned.epoch)return;if(participantAccountReadDenied(error)){setPage({accountQuery:canonical,existingAccounts:[],nextAccountCursor:null});onDenied(error);}else if(error.status===404){setPage({accountQuery:canonical,existingAccounts:[],nextAccountCursor:null});setLaterPage(false);setNotice('La página ya no está disponible. Volvé a buscar desde la primera página; conservamos tu fundamento.');}else setNotice('No se pudo consultar la lista. Conservamos tu búsqueda y el fundamento. Volvé a buscar para comprobar el estado vigente.');}
  finally{if(alive.current&&current===owned.epoch){owned.controller=null;setPending(false);onPending?.(false);}}
 }
 const accounts=page.existingAccounts,choice=selectedAccount&&selectedId&&!accounts.some(row=>row.membershipId===selectedId)?[...accounts,selectedAccount]:accounts;
 return <div className={styles.accountDirectory} data-participant-account-discovery={mode} aria-busy={pending}>
  <div className={styles.accountSearch}><label>Buscar cuenta por nombre o correo<input type="search" maxLength={80} value={query} disabled={disabled} autoComplete="off" onChange={event=>changeQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();search();}}}/></label><button type="button" disabled={disabled} onClick={()=>search()}>Buscar cuentas</button></div>
   <p className={styles.accountHint}>Cuentas activas de esta empresa. La pertenencia y el correo se comprueban al vincular.</p>
  <p role="status" aria-live="polite">{notice|| (changed?'Aplicá la búsqueda para elegir una cuenta de la lista vigente.':`${accounts.length} ${accounts.length===1?'cuenta':'cuentas'} en esta página${page.nextAccountCursor?'; hay más disponibles.':'.'}`)}</p>
  <div className={styles.actions}>{page.nextAccountCursor&&!changed&&<button type="button" disabled={disabled||pending} onClick={()=>search(page.nextAccountCursor)}>Consultar más cuentas</button>}{(laterPage||query||page.accountQuery)&&<button type="button" disabled={disabled} onClick={()=>search(null,'')}>Ver todas las cuentas</button>}</div>
   {mode==='assignment'?<label>Cuenta de la empresa<select required disabled={disabled||pending||changed} value={selectedId} onChange={event=>onSelect(event.target.value)}><option value="">Seleccioná una cuenta</option>{choice.map(account=><option key={account.membershipId} value={account.membershipId}>{account.name}{account.self===true?' · Tu cuenta':''} · {account.email||'Sin correo declarado'} · {account.roleLabel}</option>)}</select></label>:!changed&&<div className={styles.list}>{accounts.map(account=><article key={account.membershipId} className={styles.card}><div className={styles.heading}><strong>{account.name}{account.self===true?' · Tu cuenta':''}</strong><span>Rol de empresa: {account.roleLabel}</span></div><p>{account.email||'Sin correo declarado'}</p><p>{account.roleScope}</p>{account.canChangeRole&&<button disabled={disabled||pending} type="button" onClick={()=>onSelect(account.membershipId)}>Cambiar rol de {account.name}</button>}</article>)}</div>}
 </div>;
}
