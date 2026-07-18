import { clerkSetup } from '@clerk/testing/playwright';
import { expect, test as setup } from '@playwright/test';

setup.describe.configure({ mode: 'serial' });

setup('initialize Clerk development testing', async () => {
  expect(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toMatch(/^pk_test_/);
  expect(process.env.CLERK_SECRET_KEY).toMatch(/^sk_test_/);
  await clerkSetup();
});
