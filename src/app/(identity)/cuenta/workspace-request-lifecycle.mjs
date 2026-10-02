import {workspaceSessionRequest} from './workspace-session-request.mjs';

// Own only the browser request lifetime. Authentication and dispatch remain in
// the existing transport; reading the response body shares the same deadline.
export function createWorkspaceRequestLifecycle(getSessionToken, {fetchImpl,journal} = {}) {
  const controllers = new Set();
  let active = true;
  return {
    activate() { active = true; },
    abort() { active = false; for (const controller of controllers) controller.abort(); controllers.clear(); },
    async request(url, options = {}, consume = response => response.json()) {
      if (!active) throw Object.assign(new DOMException('La consulta se canceló.', 'AbortError'), {requestDispatched:false});
      const requestTimeoutMs = options.requestTimeoutMs ?? 20000;
      if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 60000) throw new TypeError('A bounded request deadline is required');
      const controller = new AbortController();
      const external = options.signal;
      const abort = () => controller.abort();
      if (external?.aborted) controller.abort();
      else external?.addEventListener('abort', abort, {once:true});
      controllers.add(controller);
      const timer = setTimeout(abort, requestTimeoutMs);
      let ticket;
      try {
        ticket=await journal?.prepare(url,{...options,signal:controller.signal});
        const response = await workspaceSessionRequest(url, {...options, signal:controller.signal}, {getSessionToken, requestTimeoutMs,...(fetchImpl?{fetchImpl}:{})});
        const result = await new Promise((resolve,reject) => {
          const aborted = () => finish(reject,new DOMException('La consulta se canceló.', 'AbortError'));
          const finish = (callback,value) => { controller.signal.removeEventListener('abort',aborted); callback(value); };
          if(controller.signal.aborted) { aborted(); return; }
          controller.signal.addEventListener('abort',aborted,{once:true});
          Promise.resolve().then(() => controller.signal.aborted ? undefined : consume(response)).then(value => finish(resolve,value),error => finish(reject,error));
        });
        if (controller.signal.aborted || !active) throw new DOMException('La consulta se canceló.', 'AbortError');
        await journal?.settle(ticket,result);
        await journal?.observe(url,result);
        if (controller.signal.aborted || !active) throw new DOMException('La consulta se canceló.', 'AbortError');
        return result;
      } catch(error) {
        // Cleanup can fail after a dispatch or a confirmed storage commit.
        // Preserve the original request error and its dispatch classification.
        try { await journal?.settle(ticket,null,error); } catch { /* The unresolved reference remains for explicit recovery. */ }
        throw error;
      } finally {
        clearTimeout(timer);
        external?.removeEventListener('abort', abort);
        controllers.delete(controller);
      }
    },
  };
}
