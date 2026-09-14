import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export interface PresenceUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface ProjectPresence {
  count: number;
  users: PresenceUser[];
}

export function useProjectSocket(projectId?: string, currentUser?: PresenceUser) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [presence, setPresence] = useState<ProjectPresence>({ count: 1, users: [] });

  useEffect(() => {
    if (!projectId) return;

    // Initialize socket connection
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // Join project room for targeted broadcasts with current user metadata
      socket.emit('join:project', {
        projectId,
        user: currentUser || { id: 'dev-user', name: 'Dev Lead' },
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for presence updates
    socket.on('presence:update', (data: ProjectPresence) => {
      if (data?.count !== undefined) {
        setPresence(data);
      }
    });

    // Listen for live updates from other team members / background workers
    socket.on('issue:created', () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
    });

    socket.on('issue:updated', (updatedIssue) => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
      if (updatedIssue?.id) {
        queryClient.invalidateQueries({ queryKey: ['issue', updatedIssue.id] });
      }
      if (updatedIssue?.issueKey) {
        queryClient.invalidateQueries({ queryKey: ['issue', updatedIssue.issueKey] });
      }
    });

    socket.on('comment:added', ({ issueId }: { issueId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['issue-comments', issueId] });
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
    });

    return () => {
      socket.emit('leave:project', { projectId });
      socket.disconnect();
      setIsConnected(false);
    };
  }, [projectId, queryClient, currentUser]);

  return {
    socket: socketRef.current,
    isConnected,
    presence,
  };
}

