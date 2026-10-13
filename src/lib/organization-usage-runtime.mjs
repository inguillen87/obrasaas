import {productionWorkspace,connectWorkspace} from './workspace-runtime.mjs';
import {createOrganizationUsage} from './organization-usage-store.mjs';
export const productionOrganizationUsage=createOrganizationUsage({workspace:productionWorkspace,connect:connectWorkspace});
