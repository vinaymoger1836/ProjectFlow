'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export function useProjectSocket(projectId?: string) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

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
      // Join project room for targeted broadcasts
      socket.emit('join:project', { projectId });
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
    };
  }, [projectId, queryClient]);

  return socketRef.current;
}
