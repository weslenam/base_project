import Fastify from 'fastify';
import { app } from './app/app.js';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3333;

const server = Fastify({ logger: true });
server.register(app);

server.listen({ port, host }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  // Avisa o Nx que o servidor está pronto (tarefas contínuas, `nx serve`).
  if (process.env.NX_READY_SIGNAL_SOCKET) {
    import('@nx/js/ready-signal')
      .then((m) => m.emitReadySignal(server.server))
      .catch(() => undefined);
  }
});

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});
