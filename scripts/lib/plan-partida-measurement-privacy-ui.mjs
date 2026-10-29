import assert from 'node:assert/strict';

// Runs only inside the existing synthetic importer QA fixture, after its
// original task-application assertions. No provider, analysis or write is added.
export async function verifyPlanPartidaMeasurementPrivacy({page,width,click,wait,setAccess,readEffects,draftIdentity,privateDraft=false}){
 const root='[data-plan-partida-preview]',before=readEffects();
 const quantity=async()=>{await page.click(root+' [data-partida-view="QUANTITIES"]');await page.waitForSelector(root+' [data-partida-quantity]');for(const selector of ['[data-partida-measurement-issue-details]','[data-partida-measurement-evidence]']){const detail=root+' '+selector;if(await page.$(detail)){if(!await page.$eval(detail,node=>node.open))await page.click(detail+' summary');assert.equal(await page.$eval(detail,node=>node.open),true);}}assert.ok(await page.$(root+' [data-measurement-draft]'));};
 const clearedOpenDetails=async()=>assert.equal(await page.$$eval('[data-partida-measurement-issue-details],[data-partida-measurement-evidence],[data-measurement-formula],[data-partida-measurement-title],[data-measurement-draft]',nodes=>nodes.length),0,'Revocation must remove private evidence that was already open');
 assert.ok(draftIdentity&&typeof draftIdentity.id==='string'&&/^[a-f0-9]{64}$/.test(draftIdentity.sourceSha256)&&typeof draftIdentity.buttonLabel==='string');
 const reopen=async()=>{await click(page,'Cerrar');await click(page,'Importar cronograma o presupuesto');await click(page,draftIdentity.buttonLabel);await page.waitForFunction(({root,identity})=>document.querySelector(root)?.dataset.sourceSha===identity.sourceSha256&&document.body.innerText.includes('Referencia del borrador: '+identity.id),{}, {root,identity:draftIdentity});await quantity();};
 await quantity();
 setAccess('ROLE_DOWNGRADE');await page.click(root+' [data-measurement-consult]');
 await page.waitForFunction(()=>!document.querySelector('[data-partida-quantity]')&&!document.querySelector('[data-measurement-flow]')&&!document.querySelector('[data-measurement-consult]'));
 await clearedOpenDetails();
 assert.equal(Boolean(await page.$(root)),!privateDraft,'Keep a public physical preview or hide the private financial preview according to its real kind');
 setAccess('ALLOW');await reopen();
 setAccess('HTML_403');await page.click(root+' [data-measurement-consult]');
 await page.waitForFunction(()=>!document.querySelector('[data-partida-quantity]')&&!document.querySelector('[data-measurement-consult]'));
 await clearedOpenDetails();
 await wait(page,'Tu permiso actual no autoriza esta acción.');
 setAccess('ALLOW');await reopen();
 await page.click('[data-link-context]');
 await page.waitForFunction(()=>!document.querySelector('[data-partida-quantity]')&&!document.querySelector('[data-measurement-draft]'));
 await clearedOpenDetails();
 const storage=await page.evaluate(()=>JSON.stringify([Object.values(sessionStorage),Object.values(localStorage)]));
 assert.doesNotMatch(storage,/SOURCE_QUANTITIES_V1|PHYSICAL_TASK_MEASUREMENT|plan-measurement-synthetic|synthetic-plan-token/);
 assert.deepEqual(readEffects(),before,'Privacy checks must not POST, repeat extraction or recover an operation');
 return {width,roleDowngradeCleared:true,html403Cleared:true,contextChangeCleared:true,noCachedQuantityAfterRevocation:true,noPrivateSourceInStorage:true,noWriteOrAnalysis:true,openedDetailsBeforeEveryRevocation:true,openedPrivateDetailsCleared:true};
}
