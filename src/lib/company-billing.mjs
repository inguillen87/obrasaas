import {WorkspaceError} from './workspace-policy.mjs';
import {companyWhatsappOnboardingEntitlement} from './company-entitlement.mjs';

const plans=new Set(['TRIAL','PRO','ENTERPRISE']);
const statuses=new Set(['TRIALING','ACTIVE','PAST_DUE','CANCELED','SUSPENDED']);
const iso=value=>value instanceof Date&&Number.isFinite(value.getTime())?value.toISOString():null;

export function createCompanyBilling({workspace}){
  if(typeof workspace?.companyRead!=='function')throw new TypeError('Canonical company read required');
  return {
    read(session,{scope}){
      return workspace.companyRead(session,{scope},async(client,member,currentScope)=>{
        // Canonical timestamp columns are UTC. The explicit conversion avoids
        // interpreting the trial according to the application host timezone.
        const rows=(await client.query(`SELECT id,name,"subscriptionPlan"::text AS "subscriptionPlan",
          "subscriptionStatus"::text AS "subscriptionStatus", "trialEndsAt" AT TIME ZONE 'UTC' AS "trialEndsAt",
          clock_timestamp() AS "observedAt" FROM public."Organization" WHERE id=$1`,[member.organizationId])).rows;
        const company=rows[0];
        if(rows.length!==1||company.id!==member.organizationId||typeof company.name!=='string'||!plans.has(company.subscriptionPlan)||!statuses.has(company.subscriptionStatus)||!iso(company.observedAt))throw new WorkspaceError('COMPANY_BILLING_UNOBSERVED',503);
        return {version:1,scope:currentScope,organization:{id:company.id,name:company.name},observedAt:iso(company.observedAt),
          subscription:{plan:company.subscriptionPlan,status:company.subscriptionStatus,trialEndsAt:iso(company.trialEndsAt),
            entitlement:companyWhatsappOnboardingEntitlement(company,{now:company.observedAt})},
          // No merchant integration or payment receipt is inferred from ACTIVE.
          billing:{state:'CONFIGURATION_PENDING',checkoutAvailable:false,paymentEvidence:'UNOBSERVED'}};
      });
    }
  };
}
