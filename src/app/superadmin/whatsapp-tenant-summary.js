function nonNegativeCount(value) {
  return Math.max(0, Number(value) || 0);
}

export function whatsappTenantSummary(tenant) {
  const verified = nonNegativeCount(tenant?.connectedChannels);
  const attention = nonNegativeCount(tenant?.attentionChannels);
  const pending = nonNegativeCount(tenant?.pendingChannels);
  const disabled = nonNegativeCount(tenant?.disabledChannels);
  const parts = [];

  if (verified > 0) parts.push(`${verified} verificado${verified === 1 ? '' : 's'}`);
  if (attention > 0) parts.push(`${attention} en atención`);
  if (pending > 0) parts.push(`${pending} pendiente${pending === 1 ? '' : 's'}`);
  if (disabled > 0) parts.push(`${disabled} desactivado${disabled === 1 ? '' : 's'}`);

  return parts.length > 0 ? parts.join(' · ') : 'Sin conectar';
}
