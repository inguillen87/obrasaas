import 'server-only';
import {productionWorkspace} from './workspace-runtime.mjs';
import {createProjectCreation} from './project-creation-store.mjs';
export const productionProjectCreation=createProjectCreation({workspace:productionWorkspace});
