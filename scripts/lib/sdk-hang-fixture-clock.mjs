// This function is serialized by Puppeteer and runs only in the synthetic page.
export function installSdkHangFixtureClock({mode,hangMode='sdk-hang',tokenFlag='__tokenMode',tokenValue='hang',endpoint='/api/identity/constructor-crm'}) {
  const timeline = window.__fixtureRequestTimeline = [];
  const record = (type, detail) => timeline.push({type,at:window.performance.now(),...detail});
  const schedule = window.setTimeout.bind(window);
  window.setTimeout = (callback, delay, ...args) => {
    // Accelerate only the intentionally unresolved SDK token. The initial GET,
    // HTTP dispatch/body deadlines, and explicit identity cancellation stay real.
    // The real token transport schedules an anonymous deadline callback;
    // the request lifecycle schedules its named abort callback. Keep the
    // latter real even during the deliberately held token scenario.
    const accelerated = mode === hangMode && window[tokenFlag] === tokenValue && delay === 15000 && typeof callback === 'function' && callback.name === '';
    const effective = accelerated ? 180 : delay;
    if ([15000,20000,55000].includes(delay)) record('timer-scheduled',{delay,effective,accelerated});
    const run = typeof callback === 'function' ? (...values) => {
      if ([15000,20000,55000].includes(delay)) record('timer-fired',{delay,effective,accelerated});
      Reflect.apply(callback,window,values);
    } : callback;
    return schedule(run,effective,...args);
  };
  const fetch = window.fetch.bind(window);
  let sequence = 0;
  window.fetch = async (url, options) => {
    if (!String(url).includes(endpoint)) return fetch(url,options);
    const requestId = ++sequence, detail = {requestId,url:String(url),method:options?.method || 'GET'};
    const aborted = () => record('fetch-aborted',{...detail,name:options.signal.reason?.name,message:options.signal.reason?.message});
    record('fetch-start',detail);
    options?.signal?.addEventListener('abort',aborted,{once:true});
    try {
      const response = await fetch(url,options);
      record('fetch-response',{...detail,status:response.status});
      return response;
    } catch (error) {
      record('fetch-error',{...detail,name:error.name,message:error.message});
      throw error;
    } finally {
      options?.signal?.removeEventListener('abort',aborted);
    }
  };
}
