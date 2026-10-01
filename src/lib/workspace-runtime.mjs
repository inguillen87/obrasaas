import { Pool } from 'pg';
import { workspaceConnectionConfig } from './workspace-policy.mjs';
import { createWorkspaceStore } from './workspace-store.mjs';
let pool;
export function connectWorkspace() {
  if (!pool) {
    pool = new Pool(workspaceConnectionConfig());
    pool.on('error', () => { console.error('WORKSPACE_DATABASE_POOL_UNAVAILABLE'); });
  }
  return pool.connect();
}
export const productionWorkspace = createWorkspaceStore({ connect: connectWorkspace });
