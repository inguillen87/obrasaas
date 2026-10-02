import { inspectConstructorCrmBuildGate } from './lib/constructor-crm-build-gate.mjs';
const proof = await inspectConstructorCrmBuildGate();
console.log(JSON.stringify({ constructorCrmSchemaCheck: proof }));
if (proof.required && !proof.passed) process.exitCode = 1;
