import {productionWorkspace} from './workspace-runtime.mjs';
import {createWorkerChannelStore} from './worker-channel-identity.mjs';
export const productionWorkerChannel=createWorkerChannelStore({workspace:productionWorkspace});
