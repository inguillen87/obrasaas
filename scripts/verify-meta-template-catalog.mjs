import {catalogCheckEnabled,inspectDemoTemplateCatalog} from './lib/meta-template-catalog-check.mjs';
try{if(catalogCheckEnabled())console.log(JSON.stringify({metaTemplateCatalogCheck:await inspectDemoTemplateCatalog()}));}
catch{console.error(JSON.stringify({metaTemplateCatalogCheck:{status:'NOT_VERIFIED',code:'META_CATALOG_CONTEXT_REJECTED',sentMessages:0}}));process.exitCode=1;}
