import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  // Track room presence: projectId -> Map<socketId, UserInfo>
  private readonly projectPresences = new Map<string, Map<string, { id: string; name: string; avatarUrl?: string | null }>>();
  // Track client's joined projects: socketId -> Set<projectId>
  private readonly clientProjects = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
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
  handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; user?: { id: string; name: string; avatarUrl?: string | null } },
  ) {
    if (data?.projectId) {
      const { projectId, user } = data;
      const roomName = `project:${projectId}`;
      client.join(roomName);

      // Track presence
      if (!this.projectPresences.has(projectId)) {
        this.projectPresences.set(projectId, new Map());
      }
      const room = this.projectPresences.get(projectId)!;
      room.set(client.id, user || { id: client.id, name: 'Active Collaborator' });

      if (!this.clientProjects.has(client.id)) {
        this.clientProjects.set(client.id, new Set());
      }
      this.clientProjects.get(client.id)!.add(projectId);

      this.logger.log(`Client ${client.id} (${user?.name || 'Anonymous'}) joined ${roomName}`);
      this.broadcastPresence(projectId);

      return { status: 'joined', room: roomName };
    }
  }

  @SubscribeMessage('leave:project')
  handleLeaveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    if (data?.projectId) {
      const { projectId } = data;
      const roomName = `project:${projectId}`;
      client.leave(roomName);

      const room = this.projectPresences.get(projectId);
      if (room) {
        room.delete(client.id);
        this.broadcastPresence(projectId);
      }

      this.clientProjects.get(client.id)?.delete(projectId);
      this.logger.log(`Client ${client.id} left ${roomName}`);
      return { status: 'left', room: roomName };
    }
  }

  private broadcastPresence(projectId: string) {
    const room = this.projectPresences.get(projectId);
    const usersMap = new Map<string, { id: string; name: string; avatarUrl?: string | null }>();
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
  broadcastIssueCreated(projectId: string, issue: any) {
    if (this.server) {
      this.server.to(`project:${projectId}`).emit('issue:created', issue);
    }
  }

  /**
   * Broadcasts issue updated event (e.g. status transition, priority change).
   */
  broadcastIssueUpdated(projectId: string, issue: any) {
    if (this.server) {
      this.server.to(`project:${projectId}`).emit('issue:updated', issue);
    }
  }

  /**
   * Broadcasts comment added event.
   */
  broadcastCommentAdded(projectId: string, issueId: string, comment: any) {
    if (this.server) {
      this.server.to(`project:${projectId}`).emit('comment:added', { issueId, comment });
    }
  }
}
