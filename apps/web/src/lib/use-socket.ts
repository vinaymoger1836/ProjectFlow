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

export function useProjectSocket(projectId?: string) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [presence, setPresence] = useState<ProjectPresence>({ count: 1, users: [] });

  useEffect(() => {
    if (!projectId) return;

    // Initialize socket connection; the server verifies this token during the handshake
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      auth: (cb) => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('supabase_token') : null;
        cb(token ? { token } : {});
      },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // Join project room; presence identity is derived server-side from the verified token
      socket.emit('join:project', { projectId }, (ack?: { status: string; message?: string }) => {
        if (ack?.status === 'error') {
          console.warn(`[Realtime] Could not join project room: ${ack.message}`);
        }
      });
    });

    socket.on('connect_error', (err) => {
      setIsConnected(false);
      console.warn(`[Realtime] Connection rejected: ${err.message}`);
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
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    });

    // Sprint lifecycle and bulk membership changes affect both sprint tallies and issue lists
    socket.on('sprint:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
    });

    socket.on('issue:updated', (updatedIssue) => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
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
  }, [projectId, queryClient]);

  return {
    socket: socketRef.current,
    isConnected,
    presence,
  };
}

