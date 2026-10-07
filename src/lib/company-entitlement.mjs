// Organization is the canonical customer, not the legacy Tenant/PlanType model.
// These values come from src/generated/prisma/enums.ts. ACTIVE is a canonical
// subscription state, not a receipt proving that a payment was collected.
const plans=new Set(['TRIAL','PRO','ENTERPRISE']);
const statuses=new Set(['TRIALING','ACTIVE','PAST_DUE','CANCELED','SUSPENDED']);
const paidPlans=new Set(['PRO','ENTERPRISE']);
const denied=reasonCode=>Object.freeze({allowed:false,basis:null,reasonCode});
const activePaidPlan=Object.freeze({allowed:true,basis:'ACTIVE_PAID_PLAN',reasonCode:null});
const currentTrial=Object.freeze({allowed:true,basis:'CURRENT_TRIAL',reasonCode:null});
const leap=year=>year%4===0&&(year%100!==0||year%400===0);

// A formatted calendar day or a local-time string loses the actual expiry.
// Accept the Date returned by PostgreSQL or an explicit RFC3339 instant only.
function instant(value){
 if(value&&typeof value==='object'){
  try{const milliseconds=Date.prototype.getTime.call(value);return Number.isFinite(milliseconds)?milliseconds:null;}catch{return null;}
 }
 if(typeof value!=='string'||value.length>40)return null;
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
 if(!match)return null;
 const [,y,m,d,h,minute,second,,zone]=match,year=Number(y),month=Number(m),day=Number(d);
 const days=[31,leap(year)?29:28,31,30,31,30,31,31,30,31,30,31];
 if(month<1||month>12||day<1||day>days[month-1]||Number(h)>23||Number(minute)>59||Number(second)>59)return null;
 if(zone!=='Z'&&(Number(zone.slice(1,3))>23||Number(zone.slice(4,6))>59))return null;
 const milliseconds=Date.parse(value);return Number.isFinite(milliseconds)?milliseconds:null;
}

/**
 * Evaluate ONLY the commercial prerequisite for WhatsApp onboarding.
 * The caller supplies a fresh canonical Organization row and an explicit
 * server clock, preferably clock_timestamp() in the same transaction. Neither
 * input may come from a request body. Callers still enforce tenant membership,
 * channel authorization, recipient consent and provider/template readiness.
 * This function never extends a trial, activates a subscription or writes DB.
 */
export function companyWhatsappOnboardingEntitlement(company,{now}={}){
 if(!company||typeof company!=='object'||Array.isArray(company))return denied('COMPANY_ENTITLEMENT_UNOBSERVED');
 const checkedAt=instant(now);if(checkedAt===null)return denied('COMPANY_ENTITLEMENT_CLOCK_UNAVAILABLE');
 const {subscriptionPlan:plan,subscriptionStatus:status}=company;
 if(!plans.has(plan))return denied('COMPANY_ENTITLEMENT_PLAN_UNSUPPORTED');
 if(!statuses.has(status))return denied('COMPANY_ENTITLEMENT_STATUS_UNSUPPORTED');
 if(status==='PAST_DUE')return denied('COMPANY_ENTITLEMENT_PAST_DUE');
 if(status==='CANCELED')return denied('COMPANY_ENTITLEMENT_CANCELED');
 if(status==='SUSPENDED')return denied('COMPANY_ENTITLEMENT_SUSPENDED');
 if(status==='ACTIVE')return paidPlans.has(plan)?activePaidPlan:denied('COMPANY_ENTITLEMENT_ACTIVE_PLAN_UNSUPPORTED');
 if(plan!=='TRIAL')return denied('COMPANY_ENTITLEMENT_TRIAL_PLAN_MISMATCH');
 const expiresAt=instant(company.trialEndsAt);if(expiresAt===null)return denied('COMPANY_ENTITLEMENT_TRIAL_EXPIRY_UNAVAILABLE');
 return expiresAt>checkedAt?currentTrial:denied('COMPANY_ENTITLEMENT_TRIAL_EXPIRED');
}
