// This verifier accepts only an explicitly named disposable loopback database.
// It never loads .env files or falls back to application connection variables.
export const EXECUTION_CI_DATABASE = 'obrasaas_execution_ci';
export function executionTestConnection(env = process.env) {
  const refuse = () => { throw new Error('Execution verification requires an explicitly acknowledged, isolated loopback PostgreSQL database.'); };
  if (env.EXECUTION_RELEASE_DISPOSABLE !== 'true'
    || env.VERCEL_ENV === 'production' || env.VERCEL_TARGET_ENV === 'production') refuse();
  const raw = env.EXECUTION_RELEASE_DATABASE_URL;
  if (typeof raw !== 'string' || raw !== raw.trim() || !raw) refuse();
  let url;
  try { url = new URL(raw); } catch { refuse(); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== '127.0.0.1' || url.port !== '5432'
    || url.pathname !== '/' + EXECUTION_CI_DATABASE || url.hash
    || url.searchParams.getAll('schema').length !== 1
    || url.searchParams.get('schema') !== 'public'
    || [...url.searchParams.keys()].some(key => key !== 'schema')) refuse();
  url.search = '';
  return url.toString();
}
