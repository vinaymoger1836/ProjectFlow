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

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:project')
  handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    if (data?.projectId) {
      const room = `project:${data.projectId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} joined room ${room}`);
      return { status: 'joined', room };
    }
  }

  @SubscribeMessage('leave:project')
  handleLeaveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    if (data?.projectId) {
      const room = `project:${data.projectId}`;
      client.leave(room);
      this.logger.log(`Client ${client.id} left room ${room}`);
      return { status: 'left', room };
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
