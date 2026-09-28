import { redirect } from 'next/navigation';
import { enterpriseAliasFor } from '@/lib/enterprise-convergence';

export default function LegacyEnterpriseAlias({ legacyPath }) {
  const target = enterpriseAliasFor(legacyPath);
  if (!target) throw new Error(`Legacy enterprise route ${legacyPath} is not approved for convergence.`);
  redirect(target);
}
