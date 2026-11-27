import {createServer} from 'node:http';
import next from 'next';

// Child of the disposable workday lab. Next's fetch/cache hooks stay outside the scenario.
const server = createServer((request, response) => app.getRequestHandler()(request, response));
await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const app = next({dev: true, webpack: true, dir: process.argv[2], hostname: '127.0.0.1', port, httpServer: server});
await app.prepare();
server.on('upgrade', (request, socket, head) => app.getUpgradeHandler()(request, socket, head));
async function close() {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await app.close();
  process.exit(0);
}
process.once('message', () => void close());
process.once('disconnect', () => void close());
process.send(port);
