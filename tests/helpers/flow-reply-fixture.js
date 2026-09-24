import { createHistoryFixture, historyScope, HISTORY_NOW } from './flow-history-fixture.js';
export function createFlowReplyFixture() {
  const f=createHistoryFixture(3),source=f.messages[0],session=f.sessions[0];
  Object.assign(session,{workerId:'worker-a',createdAt:new Date(source.createdAt),consumedAt:new Date(HISTORY_NOW.getTime()-1000),consumedExternalId:'wamid.private.reply.a'});
  const reply={id:'reply-a',conversationId:historyScope.conversationId,externalId:session.consumedExternalId,direction:'INBOUND',kind:'INTERACTIVE',body:'Se detectó una demora de materiales en el frente norte.',createdAt:new Date(HISTORY_NOW.getTime()-500),sentAt:new Date(HISTORY_NOW.getTime()-1000),
    metadata:{provider:'meta',authorized:true,workerId:session.workerId,whatsappFlowSessionId:session.id,whatsappFlowBlueprintKey:session.blueprintKey,from:'PRIVATE_PHONE_CANARY',flowToken:'PRIVATE_TOKEN_CANARY'}};
  f.messages.push(reply);
  const matches=(row,where)=>Object.entries(where).every(([key,value])=>{
    if(key==='AND')return value.every(part=>matches(row,part));
    if(key==='OR')return value.some(part=>matches(row,part));
    if(key==='metadata')return row.metadata?.[value.path[0]]===value.equals;
    return row[key]===value;
  });
  const select=(row,fields)=>row?structuredClone(Object.fromEntries(Object.keys(fields).filter(key=>fields[key]).map(key=>[key,row[key]]))):null;
  f.prisma.message.findFirst=async args=>{f.calls.push({model:'message-lookup',args:structuredClone(args)});return select(f.messages.find(row=>matches(row,args.where)),args.select);};
  f.prisma.whatsAppFlowSession.findFirst=async args=>{f.calls.push({model:'session-lookup',args:structuredClone(args)});return select(f.sessions.find(row=>matches(row,args.where)),args.select);};
  return {...f,source,session,reply};
}
