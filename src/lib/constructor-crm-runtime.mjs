import {productionWorkspace} from './workspace-runtime.mjs';
import {createConstructorCrm} from './constructor-crm-store.mjs';
export const productionConstructorCrm=createConstructorCrm({workspace:productionWorkspace});
