import http from 'node:http';
import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { initializeSocket } from './services/socketService.js';

async function start() {
  await connectDatabase();
  const server = http.createServer(app);
  initializeSocket(server);
  server.listen(env.PORT, () => {
    console.info(`StayFlow API listening on port ${env.PORT}`);
  });
  const shutdown = async (signal: string) => {
    console.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((error) => {
  console.error('Unable to start StayFlow API', error);
  process.exit(1);
});
