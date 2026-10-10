import {recoveryResult} from './workspace-recovery-journal.mjs';
import {participantKycChatCapabilities} from './participant-onboarding-next-step.mjs';

const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const applicationId=value=>typeof value==='string'&&/^customer_webhook_[a-f0-9]{64}$/.test(value);
const contextValid=value=>value&&typeof value.scope==='string'&&/^[a-f0-9]{64}$/.test(value.scope)&&id(value.projectId);

// Only the selected current roster snapshot travels in the admission command.
// Contact details remain in the private read and never enter recovery storage.
export function employeeIntakeExistingWorkerChoice(value){
 if(!id(value?.workerId)||typeof value.revision!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value.revision)||typeof value.registrationReceiptId!=='string'||!/^site_[a-f0-9]{64}$/.test(value.registrationReceiptId)||typeof value.snapshotDigest!=='string'||!/^[a-f0-9]{64}$/.test(value.snapshotDigest))return null;
 return {workerId:value.workerId,revision:value.revision,registrationReceiptId:value.registrationReceiptId,snapshotDigest:value.snapshotDigest};
}

// A confirmed admission is a reference to a private, current server read.
// It never contains contact details or authorizes an invitation or field access.
export function employeeIntakeAdmissionContinuation(reference,value){
 if(reference?.resource!=='participants'||reference.action!=='ADMIT_EMPLOYEE_INTAKE'||recoveryResult(reference,value)?.state!=='RECORDED'||!id(value.workerId)||!applicationId(value.applicationId))return null;
 return {scope:value.scope,projectId:value.projectId,id:value.applicationId,workerId:value.workerId};
}

export function employeeIntakeInvitationQuery(application,context){
 if(!contextValid(context)||!applicationId(application?.id)||!id(application?.workerId)||application.scope!==undefined&&application.scope!==context.scope||application.projectId!==undefined&&application.projectId!==context.projectId||application.destinationProjectId!==undefined&&application.destinationProjectId!==context.projectId)return null;
 return {projectId:context.projectId,scope:context.scope,workerId:application.workerId,intakeId:application.id};
}

export function employeeIntakeInvitationPreparation(snapshot,application,context){
 const query=employeeIntakeInvitationQuery(application,context);
 if(!query||snapshot?.scope!==context.scope||snapshot.projectId!==context.projectId||snapshot.participantFocus?.workerId!==query.workerId||snapshot.participantFocus?.intakeId!==query.intakeId||!Array.isArray(snapshot.records)||snapshot.records.length!==1||!Array.isArray(snapshot.employeeIntake?.records)||snapshot.employeeIntake.records.length!==1)return null;
 const item=snapshot.employeeIntake.records[0],worker=snapshot.records[0];
 if(item.id!==query.intakeId||item.status!=='ADMITTED'||item.workerId!==query.workerId||item.destinationProjectId!==context.projectId||worker.id!==query.workerId||worker.active!==true)return null;
 const chat=participantKycChatCapabilities(worker,snapshot.canManage,context.now);
 const canPrepare=snapshot.canManage===true&&snapshot.canInvite===true&&worker.status==='NOT_INVITED'&&worker.accountLinked===false&&chat.observed&&!['PENDING','CLAIMED'].includes(chat.challenge?.status);
 if(canPrepare&&(typeof item.email!=='string'||item.email.length>254||!/^\S+@\S+\.\S+$/.test(item.email)||typeof worker.revision!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(worker.revision)))return null;
 return {workerId:worker.id,canPrepare,payload:canPrepare?{workerId:worker.id,revision:worker.revision,email:item.email}:null};
}
