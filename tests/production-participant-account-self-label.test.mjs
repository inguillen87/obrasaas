import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {participantAccountPage,participantAccountStamp,participantAccountSelectionAllowed} from '../src/app/(identity)/cuenta/participant-account-discovery-format.mjs';

await loadBindings();
const require=createRequire(import.meta.url),reactUrl=pathToFileURL(require.resolve('react')).href;
const formatUrl=new URL('../src/app/(identity)/cuenta/participant-account-discovery-format.mjs',import.meta.url).href;
const source=readFileSync(new URL('../src/app/(identity)/cuenta/participant-account-discovery.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const imports=`import React,{useEffect,useRef,useState} from ${JSON.stringify(reactUrl)};\nimport {participantAccountPage,participantAccountSearch,participantAccountReadDenied} from ${JSON.stringify(formatUrl)};\nconst styles={};\n`;
const compiled=await transform(imports+source,{filename:'participant-account-discovery.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
const {ParticipantAccountDiscovery,ParticipantAccountDetails}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));

const context={scope:'a'.repeat(64),projectId:'project-current'};
const account=(membershipId,self)=>({membershipId,name:'Cuenta de la empresa',email:null,role:'ADMIN',roleLabel:'Administrador',roleScope:'Administra la empresa. Este acceso protegido no se modifica desde esta sección.',revision:'2026-10-10T04:00:00.000001',status:'ACTIVE',self,canChangeRole:false});
const page=accounts=>({detail:'existing-accounts',...context,accountQuery:'',accountId:null,existingAccounts:accounts,existingAccountsTruncated:false,nextAccountCursor:null,canManage:true,canInvite:true,canManageOfficeRoles:true});
function directory(snapshot,selectedId=''){
 const forbidden=()=>assert.fail('Rendering cannot search, select, write or call a provider');
 return renderToStaticMarkup(React.createElement(ParticipantAccountDiscovery,{...context,snapshot,mode:'assignment',selectedId,api:forbidden,onSelect:forbidden,onInvalidate:forbidden,onDenied:forbidden,onPending:forbidden}));
}
const detail=(value,assignment=true)=>renderToStaticMarkup(React.createElement(ParticipantAccountDetails,{account:value,assignment}));
const option=(html,id)=>html.match(new RegExp('<option value="'+id+'"[^>]*>([^<]*)</option>'))?.[1];

test('actual assignment options distinguish self from another administrator with identical absent contacts',()=>{
 const own=account('member-self',true),other=account('member-other',false),snapshot=page([own,other]),before=structuredClone(snapshot);
 participantAccountPage(snapshot,context);const html=directory(snapshot);
 assert.match(html,/Cuentas activas de esta empresa\. La pertenencia y el correo se comprueban al vincular\./);
 assert.doesNotMatch(html,/Cuentas verificadas/);
 assert.equal(option(html,own.membershipId),'Cuenta de la empresa · Tu cuenta · Sin correo declarado · Administrador');
 assert.equal(option(html,other.membershipId),'Cuenta de la empresa · Sin correo declarado · Administrador');
 assert.match(html,/<option value="" selected="">Seleccioná una cuenta<\/option>/);
 assert.doesNotMatch(html,/<option value="member-(self|other)" selected/);
 assert.deepEqual(snapshot,before);
});

test('actual selected self detail identifies the current account and keeps the worksite identity pending',()=>{
 const own=account('member-self',true),before=structuredClone(own),html=detail(own);
 assert.match(html,/<strong>Cuenta de la empresa · Tu cuenta<\/strong>/);
 assert.match(html,/Es la cuenta con la que estás ingresando/);
 assert.match(html,/Sin correo declarado · Rol vigente: Administrador/);
 assert.ok(html.includes(own.roleScope));
 assert.match(html,/Vincularla conserva su rol de empresa; la identidad de esta ficha continúa pendiente de revisión/);
 assert.doesNotMatch(html,/identidad verificada|identidad aprobada|correo verificado/i);
 assert.deepEqual(own,before);
});

test('matching contact labels cannot identify another account as the subject of the current session',()=>{
 const other=account('member-other',false),html=detail(other);
 assert.doesNotMatch(html,/Tu cuenta|con la que estás ingresando/);
 assert.match(html,/Sin correo declarado · Rol vigente: Administrador/);
 const sameDeclaredContact={...other,name:'Cuenta declarada',email:'same-contact@example.invalid'};
 assert.doesNotMatch(detail(sameDeclaredContact),/Tu cuenta|con la que estás ingresando/);
 assert.equal(participantAccountSelectionAllowed('ASSIGN_EXISTING',other,page([other])),true);
});

test('self detail outside assignment does not invent a pending identity state',()=>{
 const html=detail(account('member-self',true),false);
 assert.match(html,/Tu cuenta/);assert.match(html,/Es la cuenta con la que estás ingresando/);
 assert.doesNotMatch(html,/identidad de esta ficha|Vincularla conserva/);
});

test('malformed self flags reject the DTO and cannot produce a self label through truthiness',()=>{
 for(const self of ['true','false',1,0,null,undefined,{},[]]){
  const invalid=account('member-self',self),snapshot=page([invalid]);
  assert.throws(()=>participantAccountPage(snapshot,context),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
  assert.doesNotMatch(option(directory(snapshot),invalid.membershipId)||'',/Tu cuenta/);
  assert.doesNotMatch(detail(invalid),/Tu cuenta|con la que estás ingresando/);
 }
});

test('account subject changes invalidate the selection stamp even when all contact fields stay identical',()=>{
 const own=account('member-current',true),other={...own,self:false};
 participantAccountPage(page([own]),context);participantAccountPage(page([other]),context);
 assert.notEqual(participantAccountStamp(own),participantAccountStamp(other));
 const exact={...page([own]),accountId:own.membershipId};
 assert.equal(participantAccountPage(exact,{...context,accountId:own.membershipId}),exact);
 for(const changed of [{scope:'b'.repeat(64)},{projectId:'project-other'},{accountId:'member-other'}])assert.throws(()=>participantAccountPage(exact,{...context,accountId:own.membershipId,...changed}),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
 assert.equal(participantAccountSelectionAllowed('SET_OFFICE_ROLE',own,page([own])),false);
 assert.equal(participantAccountSelectionAllowed('ASSIGN_EXISTING',own,{...page([own]),canInvite:false}),false);
});
