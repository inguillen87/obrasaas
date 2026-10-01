import { get, put } from '@vercel/blob';
import { productionWorkspace } from './workspace-runtime.mjs';
import { createFieldOperations } from './field-operations-store.mjs';
import { createFieldMedia } from './field-media.mjs';
import { createPilotMediaAnalyzer } from './pilot-media.mjs';
export const productionFieldOperations=createFieldOperations({workspace:productionWorkspace});
export const productionFieldMedia=createFieldMedia({operations:productionFieldOperations,get,put,analyzer:createPilotMediaAnalyzer()});
