import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from '@babel/parser';

// Read current src at collection time: no private overlay and no fixed Git HEAD.
// This fixture invokes only the canonical read callback with explicit synthetic dependencies.
const account=new URL('../../src/app/(identity)/cuenta/',import.meta.url);
const sources=new Set(['workspace-client.js','field-operations-panel.js','material-inventory-panel.js']);
export function actualWorksiteLiveRead(file,name,deps){
 assert.ok(sources.has(file),'Only explicit worksite canonical readers may be extracted');
 const source=readFileSync(new URL(file,account),'utf8'),ast=parse(source,{sourceType:'module',plugins:['jsx']}),matches=[];
 function visit(node){if(!node||typeof node!=='object')return;if(node.type==='VariableDeclarator'&&node.id?.name===name)matches.push(node);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}}
 visit(ast);assert.equal(matches.length,1,'Exactly one canonical '+name+' hook');
 const selected=matches[0];assert.equal(selected.init?.type,'CallExpression');assert.equal(selected.init.callee?.name,'useWorksiteLiveRefresh');assert.equal(selected.init.arguments.length,1);assert.equal(selected.init.arguments[0]?.type,'ObjectExpression');
 const properties=selected.init.arguments[0].properties.filter(property=>property.key?.name==='read');assert.equal(properties.length,1);const prop=properties[0];assert.equal(prop.type,'ObjectProperty');assert.equal(prop.value.type,'ArrowFunctionExpression');assert.equal(prop.value.async,true);
 return Function(...Object.keys(deps),'"use strict";return ('+source.slice(prop.value.start,prop.value.end)+');')(...Object.values(deps));
}
