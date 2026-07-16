import test from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedCronRequest } from "../src/lib/cron-auth.js";

test("cron bearer authorization fails closed and compares the complete secret", () => {
  const secret = "independent-webhook-recovery-secret";
  assert.equal(isAuthorizedCronRequest(`Bearer ${secret}`, secret), true);
  assert.equal(isAuthorizedCronRequest(`Bearer ${secret}-suffix`, secret), false);
  assert.equal(isAuthorizedCronRequest(secret, secret), false);
  assert.equal(isAuthorizedCronRequest("Bearer ", secret), false);
  assert.equal(isAuthorizedCronRequest(`Bearer ${secret}`, ""), false);
});
