import {connectWorkspace,productionWorkspace} from './workspace-runtime.mjs';
import {createMetaCustomerProvider} from './meta-customer-provider.mjs';
import {resolveWorkerTemplateRecipient} from './worker-channel-identity.mjs';
import {createMetaCustomerTemplateSend} from './meta-customer-template-send.mjs';
export const productionMetaCustomerTemplateSend=createMetaCustomerTemplateSend({workspace:productionWorkspace,connect:connectWorkspace,resolveRecipient:resolveWorkerTemplateRecipient,provider:createMetaCustomerProvider()});
