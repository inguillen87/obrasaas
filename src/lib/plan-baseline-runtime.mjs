import {productionWorkspace} from './workspace-runtime.mjs';
import {createPlanBaseline} from './plan-baseline-store.mjs';
export const productionPlanBaseline=createPlanBaseline({workspace:productionWorkspace});
