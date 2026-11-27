import {readFile} from 'node:fs/promises';
import {runSharedWorkday} from './lib/shared-workday-scenario.mjs';

// This small, generated masonry pattern is independent of user files and media services.
const jpeg=await readFile(new URL('./fixtures/shared-workday-wall.jpg',import.meta.url));
const proof=await runSharedWorkday({jpeg});
console.log(JSON.stringify({
  status:proof.status,
  sourceRevision:proof.sourceRevision,
  databaseRemoved:true,
  businessChecks:proof.steps.map(step=>step.step),
  beforeReplay:proof.beforeReplay,
  afterReplay:proof.afterReplay,
  providerNetworkAttempts:proof.outboundNetworkAttempts
}, null, 2));
