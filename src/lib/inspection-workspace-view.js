export const INSPECTION_LIST_FILTERS = Object.freeze([
  { value: 'ALL', label: 'Todas' },
  { value: 'DRAFT', label: 'Borradores' },
  { value: 'SUBMITTED', label: 'En revisión' },
  { value: 'APPROVED', label: 'Aprobadas' },
  { value: 'OBSERVED', label: 'Observadas' },
  { value: 'REJECTED', label: 'Rechazadas' },
]);
const normalize = value => typeof value === 'string'
  ? value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR').replace(/\s+/g, ' ').trim()
  : '';
export function inspectionListSummary(records) {
  const rows=Array.isArray(records)?records:[];
  return {
    records:rows.length,
    drafts:rows.filter(row=>row?.status==='DRAFT').length,
    inReview:rows.filter(row=>row?.status==='SUBMITTED').length,
    approved:rows.filter(row=>row?.status==='APPROVED').length,
    attention:rows.filter(row=>['OBSERVED','REJECTED'].includes(row?.status)).length,
  };
}
export function filterInspectionRecords(records,{query='',status='ALL',templateKey='ALL'}={}) {
  if(!Array.isArray(records)) return [];
  const tokens=normalize(query).split(' ').filter(Boolean);
  return records.filter(row=>{
    if(status!=='ALL'&&row?.status!==status)return false;
    if(templateKey!=='ALL'&&row?.templateKey!==templateKey)return false;
    if(!tokens.length)return true;
    const haystack=normalize([row?.id,row?.title,row?.location,row?.templateKey].filter(Boolean).join(' '));
    return tokens.every(token=>haystack.includes(token));
  });
}
