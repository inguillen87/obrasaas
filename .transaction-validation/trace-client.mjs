// Diagnostic-only wrapper in an isolated fixture process. Does not alter query ordering/results.
import pg from 'pg';
const original=pg.Client.prototype.query;
function description(query){
  const text=typeof query==='string'?query:query?.text;
  if(typeof text!=='string')return {kind:'unknown'};
  return {kind:text.trim().split(/\s+/)[0],tables:[...text.matchAll(/(?:FROM|JOIN|INTO|UPDATE)\s+(?:"public"\.)?"([A-Za-z_]+)"/gi)].map(match=>match[1])};
}
pg.Client.prototype.query=function(...args){
  if(this.activeQuery){console.error('ISOLATED_QUERY_OVERLAP',JSON.stringify({next:description(args[0]),active:description(this.activeQuery)}));console.error(new Error('Isolated query dispatch stack').stack);}
  return original.apply(this,args);
};
