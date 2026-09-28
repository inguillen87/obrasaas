const STATUS = Object.freeze({
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  ACTIVE: { label: 'Vigente', tone: 'success' },
  SUPERSEDED: { label: 'Reemplazado', tone: 'muted' },
});
const amount = value => { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : 0; };
export function budgetVersionTotal(row) { return Array.isArray(row?.lines) ? row.lines.reduce((sum,line)=>sum+amount(line?.amount),0) : 0; }
export function budgetStatusPresentation(status) { return STATUS[status] || { label: 'Estado no clasificado', tone: 'warning' }; }
export function budgetControlSummary(rows) {
  const budgets=Array.isArray(rows)?rows:[],active=budgets.find(row=>row?.status==='ACTIVE')||null,drafts=budgets.filter(row=>row?.status==='DRAFT');
  return { versions:budgets.length, drafts:drafts.length, active, activeTotal:budgetVersionTotal(active), activeCurrency:active?.currency||null, latest:budgets[0]||null };
}
export function budgetLineCurrencyMap(budgets) {
  const map=new Map();
  for(const budget of Array.isArray(budgets)?budgets:[]) for(const line of Array.isArray(budget?.lines)?budget.lines:[]) if(typeof line?.id==='string'&&line.id) map.set(line.id,budget.currency||null);
  return map;
}
export function enrichBudgetEntriesWithCurrency(entries,budgets) {
  const map=budgetLineCurrencyMap(budgets);
  return (Array.isArray(entries)?entries:[]).map(entry=>({...entry,currency:map.get(entry?.budgetLineId)||null}));
}
export function budgetLedgerGroups(entries) {
  const groups=new Map();
  for(const entry of Array.isArray(entries)?entries:[]) {
    const currency=typeof entry?.currency==='string'&&/^[A-Z]{3}$/.test(entry.currency)?entry.currency:'SIN_MONEDA';
    if(!groups.has(currency)) groups.set(currency,{currency,COMMITMENT:0,ACTUAL:0,FORECAST:0,count:0});
    const group=groups.get(currency); if(['COMMITMENT','ACTUAL','FORECAST'].includes(entry?.kind)) group[entry.kind]+=amount(entry.amount); group.count++;
  }
  return [...groups.values()].sort((a,b)=>a.currency.localeCompare(b.currency));
}
