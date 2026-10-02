import {get,put} from '@vercel/blob';
import {connectWorkspace,productionWorkspace} from './workspace-runtime.mjs';
import {createPilotMediaAnalyzer} from './pilot-media.mjs';
import {createMetaDemoPilot} from './meta-demo-pilot.mjs';
export const productionMetaDemoPilot=createMetaDemoPilot({connect:connectWorkspace,workspace:productionWorkspace,get,put,analyzer:createPilotMediaAnalyzer()});
