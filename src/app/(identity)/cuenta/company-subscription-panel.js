'use client';
import {useCallback,useEffect,useId,useRef,useState} from 'react';
import {ArrowUpRight,Check,CreditCard,RefreshCw,ShieldCheck} from 'lucide-react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {browserCompanySubscriptionJournal,COMPANY_SUBSCRIPTION_RECOVERY_EVENT,companySubscriptionVerifiedView,companySubscriptionAcceptCommand,companySubscriptionBeginCommand,companySubscriptionCancelCommand,companySubscriptionErrorMessage} from './company-subscription-view.mjs';
import {CompanyUsagePanel} from './company-usage-panel';
import styles from './company-subscription-panel.module.css';

const endpoint = '/api/identity/company-subscription';
const blank = owner => ({owner,view:null,pending:null,storageReady:false,busy:false,notice:'',selected:'',confirmed:false,cancelReview:false,cancelConfirmed:false});
const denied = error => [401,403].includes(error?.status) || error?.code === 'WORKSPACE_CONTEXT_CHANGED';

export function CompanySubscriptionPanel(props) {
  return <CompanySubscriptionContent key={props.scope} {...props}/>;
}

function CompanySubscriptionContent({scope,getSessionToken,locked = false,onPending}) {
  const request = useWorkspaceRequest(getSessionToken),headingId = useId(),offerGroup = useId();
  const [result,setResult] = useState(null);
  const alive = useRef(false),epoch = useRef(0),active = useRef(null),owner = useRef(request),currentRef = useRef(null),pendingCallback = useRef(onPending);
  owner.current = request;pendingCallback.current = onPending;
  // Changing account, organization or token getter hides the previous access
  // synchronously; late responses cannot restore its plan or checkout link.
  const current = result?.owner === request ? result : null;
  currentRef.current = current;
  const busy = current?.busy === true,view = current?.view,pending = current?.pending;
  const valid = useCallback((generation,controller) => alive.current && owner.current === request && epoch.current === generation && !controller.signal.aborted,[request]);
  const api = useCallback(async (options,expected,controller) => {
    const suffix = options.method === 'POST' ? '' : '?'+new URLSearchParams({scope,...(expected.operationId?{operationId:expected.operationId}:{}),...(expected.acceptanceOperationId?{acceptanceOperationId:expected.acceptanceOperationId}:{})});
    return request(endpoint+suffix,{...options,signal:controller.signal,requestTimeoutMs:options.method === 'POST'?25000:15000},async response => {
      if (!response.ok) {
        let code;try {const body = await response.json();if (typeof body?.code === 'string' && /^[A-Z0-9_]{1,128}$/.test(body.code)) code = body.code;} catch { /* Fixed guidance also covers non-JSON session failures. */ }
        throw Object.assign(new Error('Company subscription request unconfirmed'),{status:response.status,...(code?{code}:{})});
      }
      let value;try {value = await response.json();} catch {throw Object.assign(new Error('Company subscription response unreadable'),{code:'COMPANY_SUBSCRIPTION_RESULT_UNCONFIRMED'});}
      return companySubscriptionVerifiedView(value,{scope,...expected});
    });
  },[request,scope]);

  const consult = useCallback(async (initial = false) => {
    if (active.current && !active.current.signal.aborted) return;
    const controller = new AbortController(),generation = ++epoch.current;
    active.current = controller;
    const previous = currentRef.current;
    setResult({...blank(request),pending:previous?.pending || null,busy:true});
    try {
      const organizationId = previous?.view?.organizationId || previous?.pending?.organizationId;
      const next = await api({}, organizationId?{organizationId}:{},controller);
      if (!valid(generation,controller)) return;
      let reference = null,storageReady = true,notice = '';
      try {reference = await browserCompanySubscriptionJournal.read(scope,next.organizationId,controller.signal);}
      catch (error) {storageReady = false;reference = previous?.pending || null;notice = companySubscriptionErrorMessage(error);}
      if (!valid(generation,controller)) return;
      setResult({...blank(request),view:next,pending:reference,storageReady,notice});
    } catch (error) {
      if (valid(generation,controller)) setResult({...blank(request),pending:previous?.pending || null,notice:companySubscriptionErrorMessage(error)});
    } finally {
      if (active.current === controller) active.current = null;
      if (initial && valid(generation,controller)) pendingCallback.current?.(false);
    }
  },[api,request,scope,valid]);

  useEffect(() => {
    const ownedEpoch = epoch,ownedActive = active;
    alive.current = true;
    void consult(true);
    return () => {alive.current = false;ownedEpoch.current++;ownedActive.current?.abort();ownedActive.current = null;pendingCallback.current?.(false);};
  },[consult]);
  useEffect(() => {pendingCallback.current?.(busy);},[busy,request]);
  useEffect(() => {
    const changed = async () => {
      const snapshot = currentRef.current,generation = epoch.current;
      if (!snapshot?.view || owner.current !== request) return;
      try {
        const reference = await browserCompanySubscriptionJournal.read(scope,snapshot.view.organizationId);
        if (alive.current && owner.current === request && epoch.current === generation) setResult(previous => previous?.owner === request ? {...previous,pending:reference,storageReady:true,...(reference?{selected:'',confirmed:false,cancelReview:false,cancelConfirmed:false}:{})} : previous);
      } catch (error) {
        if (alive.current && owner.current === request && epoch.current === generation) setResult(previous => previous?.owner === request ? {...previous,storageReady:false,selected:'',confirmed:false,cancelReview:false,cancelConfirmed:false,notice:companySubscriptionErrorMessage(error)} : previous);
      }
    };
    window.addEventListener(COMPANY_SUBSCRIPTION_RECOVERY_EVENT,changed);
    return () => window.removeEventListener(COMPANY_SUBSCRIPTION_RECOVERY_EVENT,changed);
  },[request,scope]);

  function edit(change) {setResult(previous => previous?.owner === request ? {...previous,...change} : previous);}
  async function applyResult(next,reference,controller,generation) {
    const settled = await browserCompanySubscriptionJournal.settle(reference,next,controller.signal);
    // A closed unsent operation is not a current subscription snapshot. Read
    // the company's latest attempt before allowing another explicit purchase.
    const observed = settled && next.recovery?.state === 'NO_DISPATCH' ? await api({}, {organizationId:reference.organizationId},controller) : next;
    const retained = await browserCompanySubscriptionJournal.read(scope,observed.organizationId,controller.signal);
    if (!valid(generation,controller)) return;
    const notice = settled ? next.recovery?.state === 'NO_DISPATCH' ? 'Tu solicitud no se envió. Revisá el estado actualizado para continuar.' : reference.action === 'accept_offer' ? 'Las condiciones quedaron aceptadas para esta empresa.' : reference.action === 'cancel_renewal' ? 'La renovación quedó cancelada.' : observed.attempt?.checkoutUrl ? 'Tu plan está listo para continuar en Mercado Pago.' : 'Estado de la suscripción actualizado.' : 'El intento sigue pendiente. Comprobalo antes de enviar otra solicitud.';
    setResult({...blank(request),view:observed,pending:retained,storageReady:true,notice});
  }
  async function dispatch(command) {
    const snapshot = currentRef.current;
    if (!snapshot?.view || snapshot.pending || !snapshot.storageReady || snapshot.busy || active.current || locked) return;
    const controller = new AbortController(),generation = ++epoch.current;
    const reference = {version:1,scope,organizationId:snapshot.view.organizationId,operationId:crypto.randomUUID(),action:command.action,createdAt:Date.now()};
    let observed = null;
    active.current = controller;
    edit({busy:true,notice:'',pending:reference,selected:'',confirmed:false,cancelReview:false,cancelConfirmed:false});
    try {
      await browserCompanySubscriptionJournal.reserve(reference,controller.signal);
      if (!valid(generation,controller)) return;
      const expected = {organizationId:reference.organizationId,...(reference.action === 'accept_offer'?{acceptanceOperationId:reference.operationId}:{operationId:reference.operationId}),action:reference.action};
      const next = await api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...command,operationId:reference.operationId})},expected,controller);
      observed = next;
      if (valid(generation,controller)) await applyResult(next,reference,controller,generation);
    } catch (error) {
      if (valid(generation,controller)) {
        let retained = reference,storageReady = true;
        try {retained = await browserCompanySubscriptionJournal.read(scope,reference.organizationId,controller.signal);} catch {storageReady = false;}
        if (valid(generation,controller)) setResult({...blank(request),view:denied(error)?null:observed,pending:retained,storageReady,notice:companySubscriptionErrorMessage(error,{mutation:true})});
      }
    } finally {
      if (active.current === controller) active.current = null;
      if (valid(generation,controller)) edit({busy:false});
    }
  }
  async function recover() {
    const snapshot = currentRef.current,reference = snapshot?.pending;
    if (!reference || reference.scope !== scope || snapshot.view && snapshot.view.organizationId !== reference.organizationId || snapshot.busy || active.current) return;
    const controller = new AbortController(),generation = ++epoch.current;
    let observed = null;
    active.current = controller;edit({busy:true,notice:'',selected:'',confirmed:false,cancelReview:false,cancelConfirmed:false});
    try {
      // Explicit reconciliation inspects the same provider resource. It never
      // creates or resends a checkout, even when no receipt is yet observable.
      const next = reference.action === 'accept_offer'
        ? await api({}, {organizationId:reference.organizationId,acceptanceOperationId:reference.operationId,action:reference.action},controller)
        : await api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recover',scope,operationId:reference.operationId})},{organizationId:reference.organizationId,operationId:reference.operationId,action:reference.action},controller);
      observed = next;
      if (valid(generation,controller)) await applyResult(next,reference,controller,generation);
    } catch (error) {
      if (valid(generation,controller)) edit({view:denied(error)?null:observed,notice:companySubscriptionErrorMessage(error,{mutation:reference.action !== 'accept_offer'})});
    } finally {
      if (active.current === controller) active.current = null;
      if (valid(generation,controller)) edit({busy:false});
    }
  }
  async function checkPayment() {
    const snapshot = currentRef.current;
    if (!snapshot?.view?.attempt || snapshot.busy || active.current || pending) return;
    const controller = new AbortController(),generation = ++epoch.current;
    active.current = controller;edit({busy:true,notice:'',selected:'',confirmed:false,cancelReview:false,cancelConfirmed:false});
    const attempt = snapshot.view.attempt,operationId = attempt.cancellation && attempt.cancellation.state !== 'CONFIRMED' ? attempt.cancellation.operationId : attempt.operationId;
    try {
      const next = await api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recover',scope,operationId})},{organizationId:snapshot.view.organizationId,operationId},controller);
      if (valid(generation,controller)) setResult({...blank(request),view:next,storageReady:snapshot.storageReady,notice:'Estado actualizado con el resultado del pago.'});
    } catch (error) {
      if (valid(generation,controller)) edit({view:null,notice:companySubscriptionErrorMessage(error)});
    } finally {
      if (active.current === controller) active.current = null;
      if (valid(generation,controller)) edit({busy:false});
    }
  }
  function begin(event) {
    event.preventDefault();
    const snapshot = currentRef.current;
    try {void dispatch(companySubscriptionBeginCommand(snapshot?.view,{scope,offerId:snapshot?.view?.acceptance?.offer.id,confirmed:true}));}
    catch (error) {edit({notice:companySubscriptionErrorMessage(error),confirmed:false});}
  }
  function acceptOffer(event) {
    event.preventDefault();
    const snapshot = currentRef.current;
    try {void dispatch(companySubscriptionAcceptCommand(snapshot?.view,{scope,offerId:snapshot?.selected,confirmed:snapshot?.confirmed}));}
    catch (error) {edit({notice:companySubscriptionErrorMessage(error),confirmed:false});}
  }
  function cancelRenewal(event) {
    event.preventDefault();
    const snapshot = currentRef.current;
    try {void dispatch(companySubscriptionCancelCommand(snapshot?.view,{scope,confirmed:snapshot?.cancelConfirmed}));}
    catch (error) {edit({notice:companySubscriptionErrorMessage(error),cancelConfirmed:false});}
  }
  const selected = view?.offers.find(offer => offer.id === current?.selected);
  const decisionsDisabled = busy || locked || !current?.storageReady || Boolean(pending);
  const referencesOnly = Boolean(view && !view.offers.some(offer => offer.termsReady));
  return <section className={styles.panel} aria-labelledby={headingId} aria-busy={busy} data-company-subscription>
    <div className={styles.heading}>
      <div><p className={styles.eyebrow}>SUSCRIPCIÓN DE EMPRESA</p><h3 id={headingId}><CreditCard size={21} aria-hidden="true"/>Plan y pago</h3><p>Una suscripción para toda tu empresa. Consultá la prueba, el pago y la renovación.</p></div>
      <button type="button" className={styles.secondary} disabled={busy} onClick={() => consult()}><RefreshCw size={16} aria-hidden="true"/>{busy?'Consultando…':'Actualizar estado'}</button>
    </div>
    <div className={styles.live} role="status" aria-live="polite" aria-atomic="true">{current?.notice && <p className={styles.notice}>{current.notice}</p>}{busy && <p>Estamos comprobando el estado de esta empresa…</p>}</div>
    {pending && <div className={styles.recovery} data-subscription-recovery><h4>Hay un intento por comprobar</h4><p>Conservamos tu solicitud. Comprobarla consulta el mismo intento y evita enviar otra solicitud.</p><button type="button" className={styles.primary} disabled={busy} onClick={recover}>Comprobar este intento</button></div>}
    {view && <>
      <div className={styles.summary}><div><p className={styles.company}>{view.companyName}</p><p className={styles.plan}>{view.planLabel}</p></div><span className={view.tone === 'positive'?styles.positive:styles.attention}>{view.statusLabel}</span></div>
      <dl className={styles.facts}>
        {view.trialExpiryLabel && <div><dt>{view.trialCurrent?'Tu prueba vence':'Vencimiento de la prueba'}</dt><dd>{view.trialExpiryLabel}</dd></div>}
        <div><dt>Pago</dt><dd>{view.paymentLabel}</dd></div>
        {view.attempt?.paidThroughLabel && <div><dt>Acceso pagado hasta</dt><dd>{view.attempt.paidThroughLabel}</dd></div>}
        {view.attempt && <div><dt>Abono elegido</dt><dd>{view.attempt.priceLabel} por mes</dd></div>}
      </dl>
      <CompanyUsagePanel scope={scope} organizationId={view.organizationId} getSessionToken={getSessionToken} locked={locked}/>
      {!view.configurationReady && !referencesOnly && <div className={styles.setup} data-subscription-setup><ShieldCheck size={22} aria-hidden="true"/><div><h4>El pago en línea todavía no está habilitado</h4><p>Los precios son informativos. La aceptación de condiciones y el cobro se confirman por separado.</p></div></div>}
      {referencesOnly ? <div className={styles.purchase} data-commercial-offers data-commercial-references>
        <fieldset className={styles.offers}>
          <legend>Planes de referencia</legend>
          <div className={styles.offerGrid}>{view.offers.map(offer => <article className={styles.offer} style={{cursor:'default'}} key={offer.id}>
            <h4 className={styles.offerHeading}>{offer.planLabel}</h4>
            <span className={styles.price}>{offer.priceLabel}<small>{offer.periodLabel}</small></span>
            {offer.taxTreatment !== null && <span className={styles.tax}>{offer.taxLabel}</span>}
          </article>)}</div>
        </fieldset>
        <p className={styles.note} data-commercial-pending>La contratación todavía requiere confirmar las condiciones finales y la forma de pago.</p>
        <div className={styles.included}><Check size={18} aria-hidden="true"/><p>Un único abono para toda la empresa, sin adicionales automáticos.</p></div>
        <a className={pending?styles.secondary:styles.primary} href="mailto:info@obrasaas.com" data-company-plan-support>Consultar contratación</a>
        <details className={`${styles.note} ${styles.conditions}`} data-commercial-pending-details><summary>Ver condiciones de contratación</summary><p>Antes de contratar, se confirmarán los impuestos, los servicios incluidos y las condiciones del plan.</p><p>La consulta abre un borrador de correo para que lo revises y envíes.</p></details>
      </div> : <form onSubmit={acceptOffer} className={styles.purchase} data-commercial-offers>
        <fieldset className={styles.offers} disabled={decisionsDisabled}>
          <legend>Elegí el plan de tu empresa</legend>
          <div className={styles.offerGrid}>{view.offers.map(offer => <label className={`${styles.offer} ${current?.selected === offer.id?styles.selected:''}`} key={offer.id}>
            <span className={styles.offerHeading}><span>{offer.planLabel}</span><input type="radio" name={offerGroup} value={offer.id} checked={current?.selected === offer.id} onChange={() => edit({selected:offer.id,confirmed:false,notice:''})}/></span>
            <span className={styles.price}>{offer.priceLabel}<small>{offer.periodLabel}</small></span>
            <span className={styles.tax}>{offer.taxLabel}</span>
          </label>)}</div>
        </fieldset>
        {view.commercial.state === 'TERMS_PENDING' && <p className={styles.note} data-commercial-pending>Hay condiciones comerciales y servicios incluidos pendientes de aprobación. Las ofertas con condiciones pendientes no pueden aceptarse ni pagarse.</p>}
        <div className={styles.included}><Check size={18} aria-hidden="true"/><p>Un único abono para toda la empresa, sin adicionales automáticos. Las condiciones de los servicios incluidos se detallan en cada oferta.</p></div>
        {selected && <div className={styles.review}>
          <p><strong>{selected.planLabel} · {selected.priceLabel} por empresa / mes</strong></p><p>{selected.taxLabel}</p>
          {selected.termsReady && view.termsVerified?<><p className={styles.terms} data-offer-included>{selected.includedTerms}</p><h4>Condiciones de la oferta · {selected.termsVersion}</h4><div className={styles.terms} data-offer-terms>{selected.termsText}</div><label className={styles.confirmation}><input type="checkbox" checked={current?.confirmed === true} disabled={decisionsDisabled || !selected.canAccept} onChange={event => edit({confirmed:event.target.checked})}/><span>Leí y acepto estas condiciones, el importe en {selected.currency} y los impuestos informados para esta empresa.</span></label></>:<p data-offer-terms-pending>Las condiciones comerciales, los impuestos y los servicios incluidos están pendientes de aprobación. Todavía no podés aceptar esta oferta ni iniciar el pago.</p>}
        </div>}
        <button type="submit" className={styles.primary} disabled={decisionsDisabled || !selected?.canAccept || !current?.confirmed}>Aceptar condiciones{selected?` de ${selected.planLabel}`:''}<Check size={17} aria-hidden="true"/></button>
        <p className={styles.note}>Aceptar condiciones registra tu decisión. El pago requiere un paso posterior.</p>
      </form>}
      {view.acceptance?.current && <div className={styles.accepted} data-offer-acceptance><h4>Condiciones aceptadas · {view.acceptance.offer.planLabel}</h4><p>{view.acceptance.offer.priceLabel} por empresa / mes · {view.acceptance.offer.termsVersion}</p><p className={styles.terms}>{view.acceptance.offer.taxTreatment}</p><p className={styles.terms}>{view.acceptance.offer.includedTerms}</p><details><summary>Consultar las condiciones aceptadas</summary><div className={styles.terms}>{view.acceptance.offer.termsText}</div></details>{view.canBegin?<form onSubmit={begin} data-subscription-begin><button type="submit" className={styles.primary} disabled={decisionsDisabled}>Continuar con {view.acceptance.offer.planLabel}<ArrowUpRight size={17} aria-hidden="true"/></button><p className={styles.note}>Revisarás y autorizarás el pago en Mercado Pago. La autorización se comprueba por separado del pago.</p></form>:<p className={styles.note}>{!view.configurationReady?'El pago en línea todavía no está habilitado.':view.attempt?'Consultá el intento de pago actual para continuar.':'La oferta requiere una nueva consulta antes de iniciar el pago.'}</p>}</div>}
      {view.configurationReady && view.attempt?.checkoutUrl && !pending && <div className={styles.checkout}><h4>Continuá tu suscripción en Mercado Pago</h4><p>{view.attempt.planLabel} · {view.attempt.priceLabel} por mes. El pago se confirmará al comprobar el resultado.</p><p>{view.attempt.taxLabel}</p><p>Renovación mensual. Un único abono, sin adicionales automáticos.</p><a className={styles.primary} href={view.attempt.checkoutUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Continuar en Mercado Pago<ArrowUpRight size={17} aria-hidden="true"/></a><button type="button" className={styles.secondary} disabled={busy} onClick={checkPayment}>Ya volví · comprobar pago</button></div>}
      {view.attempt && (!view.attempt.checkoutUrl || !view.configurationReady) && !pending && <div className={styles.payment}><button type="button" className={styles.secondary} disabled={busy} onClick={checkPayment}>Comprobar pago y renovación</button></div>}
      {view.canCancel && !pending && <div className={styles.renewal}>
        {!current?.cancelReview?<button type="button" className={styles.textButton} disabled={decisionsDisabled} onClick={() => edit({cancelReview:true,cancelConfirmed:false,notice:''})}>Cancelar renovación</button>:<form onSubmit={cancelRenewal} className={styles.review} data-subscription-cancel>
          <h4>Cancelar renovación</h4><p>Se detendrán los próximos cobros de esta suscripción.{view.attempt?.paidThroughLabel?` Conservás el acceso pagado hasta ${view.attempt.paidThroughLabel}.`:' La cancelación no genera un reembolso.'}</p>
          <label className={styles.confirmation}><input type="checkbox" checked={current.cancelConfirmed} disabled={decisionsDisabled} onChange={event => edit({cancelConfirmed:event.target.checked})}/><span>Quiero cancelar la renovación mensual de esta empresa.</span></label>
          <div className={styles.actions}><button type="submit" className={styles.cancelButton} disabled={decisionsDisabled || !current.cancelConfirmed}>Confirmar cancelación de renovación</button><button type="button" className={styles.secondary} disabled={busy} onClick={() => edit({cancelReview:false,cancelConfirmed:false})}>Volver</button></div>
        </form>}
      </div>}
      {view.attempt?.cancelAtPeriodEnd && <p className={styles.note}>La renovación está cancelada.{view.attempt.paidThroughLabel?' Tu acceso se conserva hasta el vencimiento del período pagado.':''}</p>}
      <p className={styles.observed}>Última consulta: {view.observedAtLabel}</p>
    </>}
  </section>;
}
