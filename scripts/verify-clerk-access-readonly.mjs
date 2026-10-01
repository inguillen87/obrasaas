import { inspectClerkAccessBuildGate } from './lib/clerk-access-build-gate.mjs';

const result = await inspectClerkAccessBuildGate();
console.log(JSON.stringify({ clerkAccessBuildCheck: result }));
if (result.required && !result.passed) process.exitCode = 1;
