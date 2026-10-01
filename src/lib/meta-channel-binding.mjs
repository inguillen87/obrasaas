// These are public asset identifiers already verified for ObraSaaS, not secrets.
// Keep the existing Vercel credentials; this module never creates/renews tokens.
export const OBRASAAS_META_CHANNEL = Object.freeze({
  appId: '1665088767899217',
  wabaId: '2046153882937995',
  phoneNumberId: '1225843560610854',
  displayNumber: '+1 555-153-3706',
});

const aliases = [
  ['META_APP_ID', 'NEXT_PUBLIC_META_APP_ID', 'appId'],
  ['META_PHONE_NUMBER_ID', 'WHATSAPP_PHONE_NUMBER_ID', 'phoneNumberId'],
];

export function checkObrasaasMetaBinding(environment = process.env) {
  // Unit tests and explicitly separate preview fixtures may use synthetic assets.
  // The production environment is supplied by Vercel, not by a request body.
  if (environment.VERCEL_ENV !== 'production') return { ok: true, enforced: false };
  for (const [canonical, legacy, field] of aliases) {
    const left = environment[canonical], right = environment[legacy];
    if (left && right && left !== right) {
      return { ok: false, enforced: true, code: 'META_PINNED_CONFIG_CONFLICT' };
    }
    if ((left || right) !== OBRASAAS_META_CHANNEL[field]) {
      return { ok: false, enforced: true, code: 'META_PINNED_ASSET_MISMATCH' };
    }
  }
  if (environment.META_WABA_ID !== OBRASAAS_META_CHANNEL.wabaId) {
    return { ok: false, enforced: true, code: 'META_PINNED_ASSET_MISMATCH' };
  }
  // No defaults to a different number, WABA, app, sender or new credential.
  return { ok: true, enforced: true };
}
