import 'server-only';

import { forbidden } from 'next/navigation';

import { AccessError } from '@/lib/access';

export async function resolvePageAccess(resolver) {
  try {
    return await resolver();
  } catch (error) {
    if (error instanceof AccessError && error.status === 403) {
      forbidden();
    }
    throw error;
  }
}
