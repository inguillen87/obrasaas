import {connectWorkspace} from './workspace-runtime.mjs';
import {createOfficeChatStore} from './office-chat-store.mjs';
export const productionOfficeChat=createOfficeChatStore({connect:connectWorkspace});
