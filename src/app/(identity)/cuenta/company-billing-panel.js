'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {CreditCard,RefreshCw} from 'lucide-react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {companyBillingErrorMessage,companyBillingView} from './company-billing-view.mjs';
import styles from './company-billing-panel.module.css';

function CompanyBillingContent({scope,getSessionToken}) {
  const request = useWorkspaceRequest(getSessionToken);
  const headingId = useId();
  const [result,setResult] = useState(null);
  const mounted = useRef(false), generation = useRef(0), active = useRef(null);
  useEffect(() => {
    const epoch = generation, controller = active;
    mounted.current = true;
    return () => {mounted.current = false; epoch.current++; controller.current?.abort();};
  },[request]);
  // A changed token getter owns a new lifecycle. Data from the previous access
  // disappears immediately, even before effect cleanup or the next manual read.
  const current = result?.request === request ? result : null;
  const busy = current?.busy === true;
  const view = current?.view;
  async function consult() {
    if (active.current && !active.current.signal.aborted) return;
    const controller = new AbortController(); active.current = controller;
    const epoch = ++generation.current;
    setResult({request,busy:true,view:null,notice:''});
    try {
      const value = await request('/api/identity/company-billing?'+new URLSearchParams({scope}), {signal:controller.signal,requestTimeoutMs:15000}, async response => {
        // Expired sessions and proxy denials may contain HTML. Keep the HTTP
        // status without reading or displaying provider-controlled error text.
        if (!response.ok) throw Object.assign(new Error('Company billing read failed'),{status:response.status});
        try {return await response.json();} catch {throw Object.assign(new Error('Company billing response unreadable'),{code:'COMPANY_BILLING_RESULT_UNCONFIRMED'});}
      });
      if (!mounted.current || epoch !== generation.current || controller.signal.aborted) return;
      setResult({request,busy:false,view:companyBillingView(value,{scope}),notice:''});
    } catch(error) {
      if (mounted.current && epoch === generation.current) setResult({request,busy:false,view:null,notice:companyBillingErrorMessage(error)});
    } finally {
      if (active.current === controller) active.current = null;
    }
  }
  return <section className={styles.panel} aria-labelledby={headingId} aria-busy={busy}>
    <div className={styles.heading}>
      <div><h3 id={headingId}><CreditCard size={20} aria-hidden="true"/>Plan y pago</h3><p>Consultá la suscripción de tu empresa y el vencimiento de la prueba.</p></div>
      <button type="button" onClick={consult} disabled={busy}><RefreshCw size={16} aria-hidden="true"/>{busy?'Consultando…':view?'Actualizar plan':'Consultar plan'}</button>
    </div>
    <div className={styles.live} role="status" aria-live="polite" aria-atomic="true">
      {busy&&<p>Consultando el estado de esta empresa…</p>}
      {current?.notice&&<p className={styles.notice}>{current.notice}</p>}
    </div>
    {view&&<div className={styles.body}>
      <div className={styles.summary}><div><p className={styles.company}>{view.companyName}</p><p className={styles.plan}>{view.planLabel}</p></div><span className={view.tone==='positive'?styles.positive:styles.attention}>{view.statusLabel}</span></div>
      <p className={styles.description}>{view.entitlementLabel}</p>
      {view.trialExpiryLabel&&<dl className={styles.expiry}><div><dt>Vencimiento registrado de la prueba</dt><dd>{view.trialExpiryLabel}</dd></div></dl>}
      <div className={styles.payment}><strong>{view.checkoutLabel}</strong><p>{view.paymentLabel}</p></div>
      <p className={styles.observed}>Última consulta: {view.observedAtLabel}</p>
    </div>}
  </section>;
}

export function CompanyBillingPanel(props) {
  return <CompanyBillingContent key={props.scope} {...props}/>;
}
