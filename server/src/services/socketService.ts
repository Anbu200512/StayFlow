import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { verifyAccessToken } from '../utils/jwt.js';

let io: Server | undefined;

export function initializeSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: true, credentials: true },
    transports: ['websocket', 'polling'],
  });
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('Authentication required');
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });
  io.on('connection', (socket) => {
    const payload = socket.data.user as { hotelId: string; sub: string; role: string };
    socket.join(`hotel:${payload.hotelId}`);
    socket.join(`user:${payload.sub}`);
    socket.emit('connected', { connectedAt: new Date().toISOString() });
  });
  return io;
}

export function emitHotelEvent(hotelId: string, event: string, payload: unknown): void {
  io?.to(`hotel:${hotelId}`).emit(event, payload);
}

export function emitUserEvent(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function getSocketServer(): Server | undefined {
  return io;
}
