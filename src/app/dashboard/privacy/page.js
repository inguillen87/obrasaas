import { AccessError, getPlatformAccess } from '@/lib/access';
import {
  createDataSubjectReviewReadAdapter,
  DataSubjectReviewError,
} from '@/lib/data-subject-review';
import {
  authorizeDataSubjectReviewAccess,
  dataSubjectReviewScope,
} from '@/lib/data-subject-review-routes';
import { resolvePageAccess } from '@/lib/page-access';
import { getPrisma } from '@/lib/prisma';

import PrivacyReviewConsole from './privacy-review-console';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Control de privacidad',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PrivacyReviewPage() {
  await resolvePageAccess(async () => {
    const access = await getPlatformAccess({
      requireProject: false,
      resolveProject: false,
    });
    authorizeDataSubjectReviewAccess(access);
    try {
      await createDataSubjectReviewReadAdapter(getPrisma()).requireAdmin(
        dataSubjectReviewScope(access),
      );
    } catch (error) {
      if (
        error instanceof DataSubjectReviewError
        && error.code === 'PRIVACY_REVIEW_FORBIDDEN'
        && error.status === 403
      ) {
        throw new AccessError('Active tenant ADMIN membership required.', {
          code: 'TENANT_ADMIN_REQUIRED',
          status: 403,
        });
      }
      throw error;
    }
    return access;
  });

  return <PrivacyReviewConsole />;
}
