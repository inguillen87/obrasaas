import assert from 'node:assert/strict';
import {copyFileSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
import {IDENTITY_INSTANCE, IDENTITY_ORIGIN, IDENTITY_PUBLIC_KEY} from '../src/lib/production-identity-config.mjs';

// Local component evidence only: no real Clerk session, invitation, JWT or user.
assert.ok(!process.env.VERCEL && !process.env.VERCEL_ENV, 'Local fixture only');
const root = realpathSync(process.cwd()), parent = path.join(root, '.vercel');
const output = path.join(parent, 'clerk-access-evidence');
mkdirSync(output, {recursive:true});
const dir = mkdtempSync(path.join(parent, 'clerk-access-ui-'));
const src = path.join(dir, 'src'), app = path.join(src, 'app'), identity = path.join(app, '(identity)');
const copy = (from, to) => {mkdirSync(path.dirname(to), {recursive:true}); copyFileSync(from, to);};
const write = (file, content) => {mkdirSync(path.dirname(file), {recursive:true}); writeFileSync(file, content);};
for (const file of readdirSync(path.join(root, 'src/app/(identity)/cuenta')).filter(name => /\.(js|mjs|css)$/.test(name))) {
  copy(path.join(root, 'src/app/(identity)/cuenta', file), path.join(identity, 'cuenta', file));
}
for (const segment of ['sign-in', 'sign-up']) copy(path.join(root, 'src/app/(identity)', segment, `[[...${segment}]]/page.js`), path.join(identity, segment, `[[...${segment}]]/page.js`));
copy(path.join(root, 'src/app/(identity)/identity.module.css'), path.join(identity, 'identity.module.css'));
for (const file of ['production-identity-config.mjs', 'identity-return-path.mjs', 'session-recovery.mjs', 'worker-channel-consent-policy.mjs']) copy(path.join(root, 'src/lib', file), path.join(src, 'lib', file));
for (const file of ['brand-logo.js', 'brand-logo.module.css', 'brand-geometry.js']) copy(path.join(root, 'src/app/brand', file), path.join(app, 'brand', file));
write(path.join(dir, 'package.json'), JSON.stringify({name:'synthetic-clerk-access-ui',private:true}));
write(path.join(dir, 'jsconfig.json'), JSON.stringify({compilerOptions:{baseUrl:'.',paths:{'@/*':['src/*']}}}));
write(path.join(dir, 'next.config.mjs'), `export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}},webpack(config){config.resolve.alias['@clerk/nextjs']=${JSON.stringify(path.join(dir, 'synthetic-clerk.js'))};return config;}};`);

// Replace only the verifier dependency inside this disposable fixture. The real
// AccountPage and real Next router/SSR are retained; cryptographic auth is not tested.
write(path.join(src, 'lib/verified-session.mjs'), `export async function verifyProductionSession(headers){
 const cookie=headers.get('cookie')||'';
 if(cookie.includes('__fixture_ssr=unavailable'))return {authenticated:false,code:'IDENTITY_PROVIDER_UNAVAILABLE',businessAccessEnabled:false};
 const token=cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith('__session='))?.slice(10);
 const accepted=!cookie.includes('__fixture_ssr=hold')&&['fixture.userA.signature','fixture.userB.signature'].includes(token);
 return accepted?{authenticated:true,userId:'user_Fixture',verification:'controlled-fixture-verifier',businessAccessEnabled:false}:{authenticated:false,code:'SESSION_REQUIRED',businessAccessEnabled:false};
}`);
write(path.join(app, 'layout.js'), `import {FixtureControls} from '../../synthetic-clerk';export default function Layout({children}){return <html lang="es"><body style={{margin:0,background:'#070c15',color:'#eef4ff',fontFamily:'Arial,sans-serif'}}><FixtureControls>{children}</FixtureControls></body></html>}`);
write(path.join(identity, 'layout.js'), `import styles from './identity.module.css';export default function Layout({children}){return <main className={styles.shell}>{children}</main>}`);
write(path.join(app, 'page.js'), `export default function Page(){return <p>Ensayo local de componentes de acceso.</p>}`);

write(path.join(dir, 'synthetic-clerk.js'), `'use client';
import {useSyncExternalStore,useEffect} from 'react';import Link from 'next/link';import {useRouter} from 'next/navigation';
const initial={isLoaded:false,isSignedIn:false,userId:null,sessionId:null,orgId:null,orgRole:null};
const snapshot=()=>window.__clerkFixture||initial;
const subscribe=fn=>{window.addEventListener('clerk-fixture',fn);return()=>window.removeEventListener('clerk-fixture',fn);};
function setState(patch){window.__clerkFixture={...snapshot(),...patch};window.dispatchEvent(new Event('clerk-fixture'));}
async function getToken(options){
 window.__tokenReads=(window.__tokenReads||[]).concat([options]);
 const state=snapshot(),token=state.token;
 if(state.tokenDelay)await new Promise(resolve=>{window.__releaseToken=resolve;});
 if(state.cookieSync&&token)document.cookie='__session='+token+'; path=/; SameSite=Lax';
 return token;
}
export function useAuth(){return {...useSyncExternalStore(subscribe,snapshot,()=>initial),getToken};}
export function useOrganization(){const state=useAuth();return {organization:state.orgId?{id:state.orgId,name:'Organización de ensayo'}:null};}
export function UserButton(){return <span>Cuenta sintética de ensayo</span>;}
function Widget({kind,props}){
 const router=useRouter();
 return <div data-fixture-widget={kind} data-routing={props.routing} data-return={props.forceRedirectUrl} data-cross-return={props.signUpForceRedirectUrl||props.signInForceRedirectUrl} style={{width:'100%',padding:16,boxSizing:'border-box',border:'1px solid #71839a'}}>
 <p>Clerk simulado exclusivamente para esta prueba</p>
 {(props.signUpUrl||props.signInUrl)&&<Link href={props.signUpUrl||props.signInUrl}>{kind==='SignIn'?'Registro sintético':'Ingreso sintético'}</Link>}
 {props.routing==='hash'&&<button type="button" onClick={()=>{window.location.hash='/verify';}}>Paso de invitación sintético</button>}
 <button type="button" onClick={()=>{document.cookie='__session=fixture.userA.signature; path=/; SameSite=Lax';setState({isSignedIn:true,userId:'user_A',sessionId:'sess_A',orgId:null,orgRole:null,token:'fixture.userA.signature',cookieSync:true});router.push(props.forceRedirectUrl);}}>Completar identidad sintética</button>
 </div>;
}
export function SignIn(props){return <Widget kind="SignIn" props={props}/>;}
export function SignUp(props){return <Widget kind="SignUp" props={props}/>;}
export function OrganizationSwitcher(props){
 const router=useRouter();
 const destinations=[['Seleccionar organización sintética','afterSelectOrganizationUrl'],['Seleccionar contexto personal sintético','afterSelectPersonalUrl'],['Salir de organización sintética','afterLeaveOrganizationUrl'],['Crear organización sintética','afterCreateOrganizationUrl']];
 return <div data-fixture-organizations>{destinations.map(([label,key])=><button type="button" key={key} data-destination={props[key]} onClick={()=>{const personal=key==='afterSelectPersonalUrl'||key==='afterLeaveOrganizationUrl';setState({orgId:personal?null:'org_B',orgRole:personal?null:'org:member',token:personal?'fixture.userA.signature':'fixture.userB.signature'});router.replace(props[key]);}}>{label}</button>)}</div>;
}
export function FixtureControls({children}){
 const state=useAuth();useEffect(()=>{window.__setClerkFixture=setState;},[]);
 return <><aside style={{padding:8,fontSize:12,display:'flex',gap:8,flexWrap:'wrap',borderBottom:'1px solid #71839a'}}><span>Prueba local: hooks y verificador controlados</span>
 <button type="button" onClick={()=>setState({userId:'user_B',sessionId:'sess_B',orgId:'org_B',orgRole:'org:member',token:'fixture.userB.signature'})}>Cambiar sesión de ensayo</button>
 <button type="button" onClick={()=>setState({hidden:true})}>Desmontar comprobación de ensayo</button></aside>{state.hidden?<p>Comprobación desmontada</p>:children}</>;
}`);

const origin = 'http://127.0.0.1:3119';
const server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', dir, '--webpack', '--hostname', '127.0.0.1', '--port', '3119'], {
  env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN},
  stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32',
});
let log = '', browser;
for (const stream of [server.stdout, server.stderr]) stream.on('data', value => {log = (log + value).slice(-18000);});
const checks = [], errors = [], widths = [320,390,768,1280];
let signedOutLinkContrast;
const invitation = 'invite_' + 'a'.repeat(32), returnPath = '/cuenta?participar=' + invitation;
const wait = (page, text) => page.waitForFunction(value => document.body.innerText.includes(value), {timeout:20000}, text);
async function click(page, label) {
  await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()===text&&!button.disabled),{timeout:20000},label);
  const handle = await page.evaluateHandle(text => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text), label);
  assert.ok(handle.asElement(), 'Missing button: ' + label);
  await handle.asElement().click(); await handle.dispose();
}
const settle = () => new Promise(resolve => setTimeout(resolve, 250));
const validSession = () => ({authenticated:true,verification:'clerk-production-jwt',businessAccessEnabled:false,expiresAt:Math.floor(Date.now()/1000)+240});
let activeFixture;
async function fixture(name, {width=390,signedIn=true,loaded=true,cookieSync=true,ssr='hold',tokenDelay=false,controlledClock=false} = {}) {
  const context = await browser.createBrowserContext(), page = await context.newPage();
  await page.setViewport({width,height:1000});
  const record = {sessionRequests:[],businessReads:[],posts:[],external:[],refreshRequests:[],held:[],responseMode:'success',pending:new Set()};
  activeFixture={name,page,record};console.log('Scenario: '+name+' ('+width+')');
  page.on('request', request=>record.pending.add(request));
  page.on('requestfinished', request=>record.pending.delete(request));
  page.on('requestfailed', request=>record.pending.delete(request));
  page.on('pageerror', error => errors.push({name,width,message:error.message}));
  await page.evaluateOnNewDocument((state, accelerated) => {window.__clerkFixture=state;
    if(accelerated){const realTimeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>realTimeout(fn,!window.__normalTimers&&ms===15000?75:ms,...args);}
  }, {isLoaded:loaded,isSignedIn:signedIn,userId:signedIn?'user_A':null,sessionId:signedIn?'sess_A':null,orgId:null,orgRole:null,token:'fixture.userA.signature',cookieSync,tokenDelay},controlledClock);
  await context.setCookie({name:'__session',value:'expired.fixture.signature',url:origin},{name:'__fixture_ssr',value:ssr,url:origin});
  await page.setRequestInterception(true);
  page.on('request', async request => {
    try {
      const url = new URL(request.url());
      if (url.origin !== origin) {if (['data:','blob:'].includes(url.protocol)) return request.continue();record.external.push(url.hostname);return request.abort();}
      if (!['GET','HEAD','OPTIONS'].includes(request.method())) {record.posts.push({path:url.pathname,method:request.method()});return request.abort();}
      if (url.pathname === '/cuenta' && request.headers().rsc === '1') record.refreshRequests.push(url.pathname);
      if (!url.pathname.startsWith('/api/identity/')) return request.continue();
      const respond = (status, body) => request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
      const header = request.headers().authorization;
      assert.ok(['Bearer fixture.userA.signature','Bearer fixture.userB.signature'].includes(header), 'Current tab Bearer required');
      if (url.pathname === '/api/identity/session') {
        record.sessionRequests.push({method:request.method(),currentContext:header.includes('userB')?'B':'A'});
        if (record.responseMode === 'held') {record.held.push(request);return;}
        if (record.responseMode === '401') return respond(401,{code:'SESSION_INVALID'});
        if (record.responseMode === '503') return respond(503,{code:'IDENTITY_PROVIDER_UNAVAILABLE'});
        if (record.responseMode === 'expired') return respond(200,{...validSession(),expiresAt:Math.floor(Date.now()/1000)-1});
        return respond(200,validSession());
      }
      record.businessReads.push({path:url.pathname,currentContext:header.includes('userB')?'B':'A'});
      if (url.pathname === '/api/identity/workspace') return respond(200,{scope:'c'.repeat(64),organizationName:header.includes('userB')?'Organización B de ensayo':'Organización A de ensayo',roleLabel:'Consulta de ensayo',role:'WORKER',canPlanSchedule:false,canManageIntegrations:false,projects:[],projectsTruncated:false});
      if (url.pathname === '/api/identity/participant-join') {assert.equal(url.searchParams.get('invitationId'),invitation);return respond(200,{canAccept:false,state:'ACTIVE',organizationName:'Organización de ensayo',projectName:'Obra de ensayo',participantName:'Participante sintético'});}
      if (url.pathname === '/api/identity/company-onboarding') return respond(200,{state:'ALREADY_CONFIGURED',canCreate:false,organizationId:'company-fixture'});
      throw new Error('Unexpected API: ' + url.pathname);
    } catch (error) {errors.push({name,width,message:error.message});if (!request.isInterceptResolutionHandled()) await request.abort().catch(()=>{});}
  });
  const close = async () => {assert.deepEqual(record.posts, [], 'Access flow cannot auto-submit mutations');assert.deepEqual(record.external, []);await context.close();};
  return {context,page,record,close};
}
async function invitationFlow(width) {
  const f = await fixture('invitation-navigation', {width,signedIn:false,ssr:'allow'}), {page,record} = f;
  await page.goto(origin + '/sign-in?participar=' + invitation + '&redirect_url=https%3A%2F%2Fexample.invalid&token=discarded', {waitUntil:'networkidle0'});
  await page.waitForSelector('[data-fixture-widget="SignIn"]');
  assert.equal(await page.$eval('[data-fixture-widget]', e => e.dataset.return), returnPath);
  await page.click('a[href="/sign-up?participar=' + invitation + '"]');
  await page.waitForSelector('[data-fixture-widget="SignUp"]');
  assert.equal(new URL(page.url()).search, '?participar=' + invitation);
  assert.equal(await page.$eval('[data-fixture-widget]', e => e.dataset.crossReturn), returnPath);
  await page.click('a[href="/sign-in?participar=' + invitation + '"]');
  await page.waitForSelector('[data-fixture-widget="SignIn"]');
  await click(page, 'Completar identidad sintética');
  await wait(page, 'Completar mi invitación de obra');
  assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, returnPath);
  assert.deepEqual(await page.$$eval('[data-fixture-organizations] button', buttons => buttons.map(b => b.dataset.destination)), [returnPath,returnPath,returnPath,returnPath]);
  await click(page, 'Seleccionar organización sintética');
  await wait(page, 'Organización B de ensayo');
  assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, returnPath);
  await click(page, 'Consultar mi invitación'); await wait(page, 'Participante sintético');
  assert.equal(record.businessReads.find(row => row.path === '/api/identity/participant-join')?.currentContext, 'B');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({path:path.join(output, `invitation-${width}.png`),fullPage:true});
  checks.push(`invitation-signin-signup-organization-current-bearer-${width}`);await f.close();
}
async function ticketFlow(status) {
  const f = await fixture('pending-ticket-' + status, {signedIn:false,ssr:'allow'}), {page} = f;
  const query = '?participar=' + invitation + '&__clerk_ticket=synthetic-ticket-only&__clerk_status=' + status;
  await page.goto(origin + '/cuenta' + query, {waitUntil:'networkidle0'});
  await wait(page, 'Aceptá tu invitación');
  assert.equal(new URL(page.url()).search, query);
  assert.equal(await page.$eval('[data-fixture-widget]', e => e.dataset.routing), 'hash');
  assert.equal(await page.$eval('[data-fixture-widget]', e => e.dataset.return), returnPath);
  await click(page, 'Paso de invitación sintético');
  assert.equal(new URL(page.url()).search, query);assert.equal(new URL(page.url()).hash, '#/verify');
  await click(page, 'Completar identidad sintética');await wait(page, 'Completar mi invitación de obra');
  assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, returnPath);
  assert.equal(new URL(page.url()).hash, '');
  checks.push(`pending-${status}-original-ticket-url-hash-clean-return`);await f.close();
}
async function rejectedNavigation(name, query, expected='/sign-in') {
  const f = await fixture(name, {signedIn:false}), {page,record} = f;
  await page.goto(origin + '/cuenta?' + query, {waitUntil:'networkidle0'});
  await page.waitForSelector('[data-fixture-widget="SignIn"]');
  assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, expected);
  assert.ok(!(await page.evaluate(() => document.body.innerText)).includes('Aceptá tu invitación'));
  assert.equal(record.businessReads.length, 0);assert.equal(record.sessionRequests.length, 0);
  checks.push(name);await f.close();
}
async function recoveryFresh(width) {
  const f = await fixture('fresh-recovery', {width,ssr:'allow'}), {page,record} = f;
  await page.goto(origin + '/cuenta?participar=' + invitation, {waitUntil:'domcontentloaded'});
  await wait(page, 'Seleccioná o creá tu organización');
  assert.equal(record.sessionRequests.length, 1);assert.equal(record.refreshRequests.length, 1);assert.equal(record.businessReads.length, 0);
  assert.deepEqual(await page.evaluate(() => window.__tokenReads), [{skipCache:true}]);
  await click(page, 'Seleccionar organización sintética');await wait(page, 'Organización B de ensayo');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  checks.push(`expired-cookie-fresh-bearer-SSR-then-workspace-${width}`);await f.close();
}
async function recoveryError(mode) {
  const f = await fixture('recovery-' + mode, {cookieSync:mode!=='cookie',ssr:'hold'}), {page,record} = f;
  record.responseMode = mode === 'cookie' ? 'success' : mode;
  // A deliberately rejected fetch need not satisfy CDP's network-idle heuristic.
  // The user-visible phase and exact no-refresh/no-business counts are the gate.
  await page.goto(origin + '/cuenta?participar=' + invitation, {waitUntil:'domcontentloaded'});
  await wait(page, mode === '401' ? 'Tu acceso no pudo renovarse' : mode === '503' ? 'El servicio de acceso no respondió' : mode === 'expired' ? 'El servicio de acceso no respondió' : 'No se pudo sincronizar');
  assert.equal(record.sessionRequests.length, 1);assert.equal(record.refreshRequests.length, 0);assert.equal(record.businessReads.length, 0);
  assert.equal(await page.$eval('a[href^="/sign-in"]', e => e.getAttribute('href')), '/sign-in?participar=' + invitation);
  await page.screenshot({path:path.join(output, `recovery-${mode}.png`),fullPage:true});
  record.responseMode='success';await page.evaluate(() => {window.__setClerkFixture({cookieSync:true});document.cookie='__fixture_ssr=allow; path=/';});
  await click(page, 'Volver a verificar');await wait(page, 'Seleccioná o creá tu organización');
  assert.equal(record.sessionRequests.length, 2);assert.equal(record.refreshRequests.length, 1);assert.equal(record.businessReads.length, 0);
  checks.push(`${mode}-blocked-before-explicit-fresh-retry`);await f.close();
}
async function initialProviderUnavailable() {
  const f = await fixture('initial-provider-unavailable', {ssr:'unavailable'}), {page,record} = f;
  await page.goto(origin + '/cuenta', {waitUntil:'domcontentloaded'});await wait(page, 'El servicio de acceso no respondió');
  assert.equal(record.sessionRequests.length, 0);assert.equal(record.refreshRequests.length, 0);
  await page.evaluate(() => {document.cookie='__fixture_ssr=allow; path=/';});
  await click(page, 'Volver a verificar');await wait(page, 'Seleccioná o creá tu organización');
  assert.equal(record.sessionRequests.length, 1);checks.push('provider-unavailable-SSR-requires-explicit-retry');await f.close();
}
async function boundedLoading(kind) {
  const f=await fixture('bounded-'+kind,{loaded:kind!=='SDK',tokenDelay:kind==='token',controlledClock:true}),{page,record}=f;
  await page.goto(origin+'/cuenta?participar='+invitation,{waitUntil:'domcontentloaded'});
  await wait(page,kind==='SDK'?'El servicio de acceso está tardando en cargar':'El servicio de acceso no respondió');
  assert.equal(record.sessionRequests.length,0);assert.equal(record.refreshRequests.length,0);assert.equal(record.businessReads.length,0);
  assert.equal(new URL(page.url()).pathname,'/cuenta');
  assert.equal(await page.$eval('a[href^="/sign-in"]',e=>e.getAttribute('href')),'/sign-in?participar='+invitation);
  if(kind==='SDK')assert.equal(await page.$$eval('button',buttons=>buttons.some(b=>b.textContent==='Recargar página')),true);
  else{
    await page.evaluate(()=>{window.__normalTimers=true;window.__setClerkFixture({tokenDelay:false});document.cookie='__fixture_ssr=allow; path=/';});
    await click(page,'Volver a verificar');await wait(page,'Seleccioná o creá tu organización');
    assert.equal(record.sessionRequests.length,1);
  }
  checks.push(`bounded-${kind}-loading-explicit-recovery-controlled-clock`);await f.close();
}
async function boundedWorkspaceToken() {
  const f=await fixture('bounded-workspace-token',{ssr:'allow',tokenDelay:true,controlledClock:true}),{context,page,record}=f;
  await context.setCookie({name:'__session',value:'fixture.userA.signature',url:origin});
  await page.goto(origin+'/cuenta?participar='+invitation,{waitUntil:'domcontentloaded'});
  await click(page,'Seleccionar organización sintética');await wait(page,'No se pudo renovar tu sesión. Volvé a consultar.');
  assert.equal(record.businessReads.length,0);assert.equal(record.sessionRequests.length,0);
  await page.evaluate(()=>{window.__normalTimers=true;window.__oldWorkspaceToken=window.__releaseToken;window.__setClerkFixture({tokenDelay:false});});
  await click(page,'Actualizar');await wait(page,'Organización B de ensayo');
  assert.equal(record.businessReads.length,1);assert.equal(record.businessReads[0].currentContext,'B');
  await page.evaluate(()=>window.__oldWorkspaceToken());await settle();
  assert.equal(record.businessReads.length,1);
  checks.push('bounded-workspace-token-explicit-refresh-discards-late-token-controlled-clock');await f.close();
}
async function signedOutWorkspace() {
  const f=await fixture('signed-out-workspace',{ssr:'allow'}),{context,page,record}=f;
  await context.setCookie({name:'__session',value:'fixture.userA.signature',url:origin});
  await page.goto(origin+returnPath,{waitUntil:'domcontentloaded'});
  await click(page,'Seleccionar organización sintética');await wait(page,'Organización B de ensayo');
  const reads=record.businessReads.length;
  await page.evaluate(()=>window.__setClerkFixture({isSignedIn:false,userId:null,sessionId:null,orgId:null,orgRole:null,token:null}));
  await wait(page,'La sesión terminó. Volvé a ingresar antes de consultar una obra.');
  const text=await page.evaluate(()=>document.body.innerText);
  for(const privateHeading of ['Organización B de ensayo','Mis obras','Completar mi invitación de obra'])assert.ok(!text.includes(privateHeading));
  assert.equal(await page.$eval('section[role="alert"] a',e=>e.getAttribute('href')),'/sign-in?participar='+invitation);
  signedOutLinkContrast=await page.$eval('section[role="alert"] a',link=>{
    const parse=value=>value.match(/[\d.]+/g).map(Number);
    const foreground=getComputedStyle(link).color;let background='',ancestor=link;
    while(ancestor){const color=getComputedStyle(ancestor).backgroundColor,channels=parse(color);if(channels.length===3||channels[3]===1){background=color;break;}ancestor=ancestor.parentElement;}
    if(!background)throw new Error('No opaque ancestor background for link contrast');
    const luminance=value=>parse(value).slice(0,3).map(channel=>{const c=channel/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);}).reduce((sum,c,index)=>sum+c*[.2126,.7152,.0722][index],0);
    const first=luminance(foreground),second=luminance(background);
    return {foreground,background,ratio:(Math.max(first,second)+.05)/(Math.min(first,second)+.05),height:link.getBoundingClientRect().height};
  });
  assert.ok(signedOutLinkContrast.ratio>=4.5,'Signed-out login link contrast must be at least 4.5:1');
  assert.ok(signedOutLinkContrast.height>=44,'Signed-out login link needs a 44px target');
  assert.equal(record.businessReads.length,reads);assert.equal(record.sessionRequests.length,0);
  await page.screenshot({path:path.join(output,'workspace-signed-out-390.png'),fullPage:true});
  await page.click('section[role="alert"] a');await page.waitForSelector('[data-fixture-widget="SignIn"]');
  assert.equal(new URL(page.url()).pathname+new URL(page.url()).search,'/sign-in?participar='+invitation);
  assert.equal(await page.$eval('[data-fixture-widget]',e=>e.dataset.return),returnPath);
  assert.equal(record.businessReads.length,reads);
  checks.push('signed-out-workspace-removes-data-and-preserves-invitation-login-return');await f.close();
}
async function lateRecovery(kind) {
  const f = await fixture('late-' + kind, {tokenDelay:kind==='token'}), {page,record} = f;
  record.responseMode='held';await page.goto(origin + '/cuenta', {waitUntil:'domcontentloaded'});
  if (kind==='token') await page.waitForFunction(() => typeof window.__releaseToken==='function');
  else await page.waitForFunction(() => document.body.innerText.includes('Renovando y comprobando'));
  if (kind!=='token') {for (let i=0;i<40&&!record.held.length;i++) await new Promise(resolve=>setTimeout(resolve,50));assert.equal(record.held.length,1);}
  await click(page, kind==='unmount'?'Desmontar comprobación de ensayo':'Cambiar sesión de ensayo');
  await wait(page, kind==='unmount'?'Comprobación desmontada':'Cambió la cuenta o la organización');
  if (kind==='token') await page.evaluate(() => window.__releaseToken());
  else for (const request of record.held) await request.respond({status:200,contentType:'application/json',body:JSON.stringify(validSession())}).catch(()=>{});
  await settle();assert.equal(record.refreshRequests.length, 0);assert.equal(record.businessReads.length, 0);
  assert.equal((await page.$$('[aria-labelledby="workspace-title"]')).length,0);
  assert.equal((await page.$$('[data-fixture-organizations]')).length,0);
  assert.ok(!(await page.evaluate(() => document.body.innerText)).includes('Mis obras'));
  if (kind!=='unmount') {
    record.responseMode='success';await page.evaluate(() => {window.__setClerkFixture({tokenDelay:false});document.cookie='__fixture_ssr=allow; path=/';});
    await click(page, 'Volver a verificar');await wait(page, 'Organización B de ensayo');
    assert.equal(record.sessionRequests.at(-1).currentContext, 'B');assert.equal(record.businessReads.at(-1).currentContext, 'B');
  }
  checks.push(`late-${kind}-cannot-refresh-or-read-old-context`);await f.close();
}

try {
  let ready=false;
  for (let i=0;i<120;i++) {
    if (server.exitCode!==null) throw new Error('Fixture exited: ' + log.slice(-6000));
    let response;try {response=await fetch(origin);} catch {}
    await response?.body?.cancel();
    if (response?.ok) {ready=true;break;}
    if (response?.status>=500) throw new Error('Fixture compilation failed: ' + log.slice(-6000));
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(ready,'Fixture server unavailable: ' + log.slice(-6000));
  browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
  for (const width of widths) await invitationFlow(width);
  for (const status of ['sign_in','sign_up']) await ticketFlow(status);
  await rejectedNavigation('complete-ticket-does-not-reenter-Clerk', 'participar='+invitation+'&__clerk_ticket=synthetic-ticket&__clerk_status=complete', '/sign-in?participar='+invitation);
  await rejectedNavigation('duplicate-ticket-does-not-reenter-Clerk', 'participar='+invitation+'&__clerk_ticket=a&__clerk_ticket=b&__clerk_status=sign_in', '/sign-in?participar='+invitation);
  await rejectedNavigation('malformed-ticket-does-not-reenter-Clerk', 'participar='+invitation+'&__clerk_ticket=invalid%2Fticket&__clerk_status=sign_in', '/sign-in?participar='+invitation);
  await rejectedNavigation('duplicate-invitation-and-unsafe-redirect-discarded', 'participar='+invitation+'&participar='+invitation+'&returnTo=https%3A%2F%2Fexample.invalid');
  for (const width of widths) await recoveryFresh(width);
  for (const mode of ['401','503','cookie','expired']) await recoveryError(mode);
  await initialProviderUnavailable();
  for(const kind of ['SDK','token'])await boundedLoading(kind);
  await boundedWorkspaceToken();
  await signedOutWorkspace();
  for (const kind of ['response','token','unmount']) await lateRecovery(kind);
  assert.deepEqual(errors, []);
  const proof={status:'PASS',environment:'actual-source-components-local-controlled-Clerk-hooks-and-server-verifier',checks,widths,errors,signedOutLinkContrast,
    realClerkLogin:false,realClerkInvitationAcceptance:false,emailDeliveryTested:false,cryptographicJWTVerified:false,productionDataWritten:false,providerWrites:0,automaticMutationRequests:0};
  for(const file of ['browser-failure.json','browser-failure.png'])rmSync(path.join(output,file),{force:true});
  writeFileSync(path.join(output,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
} catch (error) {
  let active;
  if(activeFixture){const {name,page,record}=activeFixture;active={name,sessionRequests:record.sessionRequests,businessReads:record.businessReads,refreshRequests:record.refreshRequests,
    pending:[...record.pending].map(r=>new URL(r.url()).pathname),body:await page.evaluate(()=>document.body.innerText).catch(()=>null)};
    await page.screenshot({path:path.join(output,'browser-failure.png'),fullPage:true}).catch(()=>{});}
  writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({message:error.message,checks,errors,active,serverLog:log},null,2));throw error;
} finally {
  await browser?.close();
  try {if(process.platform!=='win32') process.kill(-server.pid,'SIGTERM');else server.kill();} catch {}
  await new Promise(resolve=>setTimeout(resolve,500));
  const resolved=realpathSync(dir);assert.equal(path.dirname(resolved),realpathSync(parent));assert.ok(path.basename(resolved).startsWith('clerk-access-ui-'));
  rmSync(resolved,{recursive:true,force:true});
}
