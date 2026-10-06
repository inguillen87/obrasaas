import {get,put} from '@vercel/blob';
import {productionWorkspace} from './workspace-runtime.mjs';
import {createPlanImport} from './plan-import-store.mjs';
import {createPlanImportAnalyzer} from './plan-import-analyzer.mjs';
export const productionPlanImport=createPlanImport({workspace:productionWorkspace,get,put,analyzer:createPlanImportAnalyzer()});
