import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ProjectAccessService } from '../auth/project-access.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { DEV_USER, isDevAuthBypassEnabled } from '../auth/auth.config';
import { UUID_REGEX } from '../../common/validators/is-entity-id.decorator';

interface PresenceUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface SocketData {
  user: AuthenticatedUser;
}

type AuthedSocket = Socket & { data: SocketData };

type RoomAck = { status: 'joined' | 'left'; room: string } | { status: 'error'; message: string };

@WebSocketGateway({
  cors: {
    // Resolved per handshake so the value from .env (loaded by ConfigModule at bootstrap) is honoured
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowedOrigin = process.env.WEB_URL || 'http://localhost:3000';
      callback(null, !requestOrigin || requestOrigin === allowedOrigin);
    },
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  // Track room presence: projectId -> Map<socketId, UserInfo>
  private readonly projectPresences = new Map<string, Map<string, PresenceUser>>();
  // Track client's joined projects: socketId -> Set<projectId>
  private readonly clientProjects = new Map<string, Set<string>>();

  constructor(
    private readonly authService: AuthService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  /**
   * Authenticates every socket during the handshake, before any event handler can run.
   * Clients pass their Supabase access token via `io(url, { auth: { token } })`.
   */
  afterInit(server: Server) {
    server.use(async (socket: Socket, next) => {
      const token: unknown = socket.handshake.auth?.token;

      try {
        if (typeof token === 'string' && token.length > 0) {
          socket.data.user = await this.authService.verifyAccessToken(token);
        } else if (isDevAuthBypassEnabled()) {
          socket.data.user = DEV_USER;
        } else {
          throw new Error('Authentication required');
        }
        next();
      } catch (err) {
        this.logger.warn(`Rejected socket ${socket.id}: ${err instanceof Error ? err.message : 'unknown error'}`);
        next(new Error('Unauthorized'));
      }
    });
  }

  handleDisconnect(client: AuthedSocket) {
    const joinedProjects = this.clientProjects.get(client.id);
    if (joinedProjects) {
      for (const projectId of joinedProjects) {
        const room = this.projectPresences.get(projectId);
        if (room) {
          room.delete(client.id);
          this.broadcastPresence(projectId);
        }
      }
      this.clientProjects.delete(client.id);
    }
  }

  @SubscribeMessage('join:project')
  async handleJoinProject(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { projectId?: unknown },
  ): Promise<RoomAck> {
    const projectId = data?.projectId;
    if (typeof projectId !== 'string' || !UUID_REGEX.test(projectId)) {
      return { status: 'error', message: 'A valid projectId is required.' };
    }

    const user = client.data.user;
    try {
      await this.projectAccess.assertProjectAccess(user.id, projectId);
    } catch {
      return { status: 'error', message: 'Access denied for this project.' };
    }

    const roomName = `project:${projectId}`;
    await client.join(roomName);

    // Presence identity always comes from the verified token, never from the client payload
    if (!this.projectPresences.has(projectId)) {
      this.projectPresences.set(projectId, new Map());
    }
    this.projectPresences.get(projectId)!.set(client.id, {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });

    if (!this.clientProjects.has(client.id)) {
      this.clientProjects.set(client.id, new Set());
    }
    this.clientProjects.get(client.id)!.add(projectId);

    this.logger.log(`Client ${client.id} (${user.name}) joined ${roomName}`);
    this.broadcastPresence(projectId);

    return { status: 'joined', room: roomName };
  }

  @SubscribeMessage('leave:project')
  async handleLeaveProject(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { projectId?: unknown },
  ): Promise<RoomAck> {
    const projectId = data?.projectId;
    if (typeof projectId !== 'string') {
      return { status: 'error', message: 'A valid projectId is required.' };
    }

    const roomName = `project:${projectId}`;
    await client.leave(roomName);

    const room = this.projectPresences.get(projectId);
    if (room) {
      room.delete(client.id);
      this.broadcastPresence(projectId);
    }

    this.clientProjects.get(client.id)?.delete(projectId);
    return { status: 'left', room: roomName };
  }

  private broadcastPresence(projectId: string) {
    const room = this.projectPresences.get(projectId);
    const usersMap = new Map<string, PresenceUser>();
    if (room) {
      for (const u of room.values()) {
        usersMap.set(u.id, u);
      }
    }
    const users = Array.from(usersMap.values());
    if (this.server) {
      this.server.to(`project:${projectId}`).emit('presence:update', {
        projectId,
        count: users.length,
        users,
      });
    }
  }

  /**
   * Broadcasts issue created event to all clients viewing the project.
   */
  broadcastIssueCreated(projectId: string, issue: unknown) {
    if (this.server) {
      this.server.to(`project:${projectId}`).emit('issue:created', issue);
    }
  }

  /**
   * Broadcasts issue updated event (e.g. status transition, priority change).
   */
  broadcastIssueUpdated(projectId: string, issue: unknown) {
    if (this.server) {
      this.server.to(`project:${projectId}`).emit('issue:updated', issue);
    }
  }

  /**
   * Broadcasts sprint lifecycle or membership changes (create, start, complete, bulk assignment).
   */
  broadcastSprintUpdated(projectId: string, sprintId: string) {
    if (this.server) {
      this.server.to(`project:${projectId}`).emit('sprint:updated', { projectId, sprintId });
    }
  }

  /**
   * Broadcasts comment added event.
   */
  broadcastCommentAdded(projectId: string, issueId: string, comment: unknown) {
    if (this.server) {
      this.server.to(`project:${projectId}`).emit('comment:added', { issueId, comment });
    }
  }
}
