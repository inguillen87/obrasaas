'use client';
import { tokens } from '@/lib/design-system';
import { restrictionsVerified } from './task-restriction-summary';
export default function TaskRestrictionBadge({ restrictions }) {
  if (!restrictionsVerified(restrictions) || !restrictions.active) return null;
  return <strong style={{ color: tokens.colors.accent.primary, display: 'block', fontSize: '.69rem', lineHeight: 1.65 }}>
    {restrictions.active} {restrictions.active === 1 ? 'restricción activa' : 'restricciones activas'}
    {restrictions.critical > 0 ? ' · prioridad crítica' : restrictions.high > 0 ? ' · prioridad alta' : ''}
    {restrictions.overdue ? ' · plazo vencido' : ''}
  </strong>;
}
