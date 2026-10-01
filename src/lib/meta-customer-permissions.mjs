// Customer Cloud API operations target WhatsApp assets, not the business portfolio.
export const META_CUSTOMER_REQUIRED_SCOPES=Object.freeze(['whatsapp_business_management','whatsapp_business_messaging']);
export function hasMetaCustomerRequiredScopes(scopes){
 return Array.isArray(scopes)&&META_CUSTOMER_REQUIRED_SCOPES.every(scope=>scopes.includes(scope));
}
