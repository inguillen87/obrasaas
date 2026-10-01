const trackedPools=new WeakMap();

// pg-pool can resolve end() after removing clients from its list but before
// their sockets finish closing. A disposable database must wait for both.
export function trackDisposablePool(pool){
 if(trackedPools.has(pool))throw new TypeError('Disposable pool already tracked');
 const ended=[];
 const connected=client=>ended.push(new Promise(resolve=>client.once('end',resolve)));
 pool.on('connect',connected);
 trackedPools.set(pool,{ended,connected});
 return pool;
}

export async function closeDisposablePool(pool){
 if(!pool)return;
 const tracked=trackedPools.get(pool);
 if(!tracked)throw new TypeError('Track the disposable pool before its first connection');
 try{await pool.end();await Promise.all(tracked.ended);}
 finally{pool.off('connect',tracked.connected);trackedPools.delete(pool);}
}
