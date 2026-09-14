'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { IssueTable } from './issue-table';
import { IssueDrawer } from './issue-drawer';
import { CreateIssueModal } from './create-issue-modal';
import { api, PaginatedIssues } from '@/lib/api';

// Demo fallback issues for initial workspace rendering before API database seed is created
const DEMO_ISSUES: PaginatedIssues['items'] = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    projectId: '11111111-1111-1111-1111-111111111111',
    issueKey: 'PAY-1',
    keyNumber: 1,
    title: 'Implement Stripe webhook signature verification and idempotency layer',
    description:
      'We must verify all incoming Stripe signatures using the endpoint secret and store event IDs in Redis with a 24-hour TTL to prevent double charges on retried webhooks.',
    type: 'TASK',
    status: 'IN_PROGRESS',
    priority: 'P0',
    storyPoints: 5,
    estimateHours: 12,
    dueDate: new Date(Date.now() + 86400000 * 3),
    isArchived: false,
    createdAt: new Date(Date.now() - 86400000 * 2),
    updatedAt: new Date(),
    reporterId: 'user-1',
    assignee: {
      id: 'user-2',
      name: 'Alex Rivera',
      email: 'alex.rivera@projectflow.dev',
      avatarUrl: null,
    },
    reporter: {
      id: 'user-1',
      name: 'Dev Lead',
      email: 'lead@projectflow.dev',
      avatarUrl: null,
    },
    labels: [
      { id: 'l1', name: 'Payments', color: '#3b82f6' },
      { id: 'l2', name: 'Security', color: '#ef4444' },
    ],
  },
  {
    id: 'e27b233a-69f8-4b72-9c12-3f89012a4567',
    projectId: '11111111-1111-1111-1111-111111111111',
    issueKey: 'PAY-2',
    keyNumber: 2,
    title: 'Fix race condition during concurrent checkout session generation',
    description:
      'Users experiencing duplicate checkout sessions when rapidly double-clicking the checkout button. Need optimistic button lock and idempotency header.',
    type: 'BUG',
    status: 'TODO',
    priority: 'P1',
    storyPoints: 3,
    estimateHours: 8,
    dueDate: new Date(Date.now() + 86400000 * 5),
    isArchived: false,
    createdAt: new Date(Date.now() - 86400000 * 1),
    updatedAt: new Date(),
    reporterId: 'user-3',
    assignee: {
      id: 'user-4',
      name: 'Sarah Chen',
      email: 'sarah.chen@projectflow.dev',
      avatarUrl: null,
    },
    reporter: {
      id: 'user-3',
      name: 'QA Lead',
      email: 'qa@projectflow.dev',
      avatarUrl: null,
    },
    labels: [{ id: 'l1', name: 'Payments', color: '#3b82f6' }],
  },
  {
    id: 'd16c122b-58ee-4a61-8b01-2e78901b3456',
    projectId: '11111111-1111-1111-1111-111111111111',
    issueKey: 'PAY-3',
    keyNumber: 3,
    title: 'Multi-currency settlement pricing display for APAC region',
    description:
      'Support automatic currency conversion for AUD, NZD, and JPY currencies with localized decimal precision in checkout modal.',
    type: 'STORY',
    status: 'IN_REVIEW',
    priority: 'P2',
    storyPoints: 8,
    estimateHours: 20,
    dueDate: new Date(Date.now() + 86400000 * 10),
    isArchived: false,
    createdAt: new Date(Date.now() - 86400000 * 4),
    updatedAt: new Date(),
    reporterId: 'user-1',
    assignee: {
      id: 'user-5',
      name: 'Michael Scott',
      email: 'michael@projectflow.dev',
      avatarUrl: null,
    },
    reporter: {
      id: 'user-1',
      name: 'Dev Lead',
      email: 'lead@projectflow.dev',
      avatarUrl: null,
    },
    labels: [{ id: 'l3', name: 'Frontend', color: '#10b981' }],
  },
  {
    id: 'c05b011a-47dd-3950-7a90-1d67890a2345',
    projectId: '11111111-1111-1111-1111-111111111111',
    issueKey: 'PAY-4',
    keyNumber: 4,
    title: 'Audit trail logging for high-value transactions (> $10,000)',
    description:
      'Compliance requires full audit logs with IP, user agent, timestamp, and signature validation recorded in secure cold storage.',
    type: 'TASK',
    status: 'DONE',
    priority: 'P2',
    storyPoints: 3,
    estimateHours: 6,
    dueDate: new Date(Date.now() - 86400000 * 2),
    isArchived: false,
    createdAt: new Date(Date.now() - 86400000 * 7),
    updatedAt: new Date(),
    reporterId: 'user-2',
    assignee: {
      id: 'user-2',
      name: 'Alex Rivera',
      email: 'alex.rivera@projectflow.dev',
      avatarUrl: null,
    },
    reporter: {
      id: 'user-2',
      name: 'Alex Rivera',
      email: 'alex.rivera@projectflow.dev',
      avatarUrl: null,
    },
    labels: [{ id: 'l2', name: 'Security', color: '#ef4444' }],
  },
];

interface IssuesViewContentProps {
  projectId?: string;
}

function IssuesViewContent({ projectId = '11111111-1111-1111-1111-111111111111' }: IssuesViewContentProps) {
  const searchParams = useSearchParams();
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Sync drawer with URL ?issue=KEY
  useEffect(() => {
    const issueParam = searchParams.get('issue');
    if (issueParam) {
      setSelectedIssueKey(issueParam);
    }
  }, [searchParams]);

  // Fetch live issues from API, with graceful fallback to DEMO_ISSUES if backend is running empty or cold
  const { data, isLoading } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      try {
        const res = await api.listIssues(projectId);
        if (res && res.items && res.items.length > 0) {
          return res.items;
        }
        return DEMO_ISSUES;
      } catch {
        return DEMO_ISSUES;
      }
    },
  });

  const handleSelectIssue = (issueKey: string) => {
    setSelectedIssueKey(issueKey);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('issue', issueKey);
      window.history.pushState({}, '', url.toString());
    }
  };

  const handleCloseDrawer = () => {
    setSelectedIssueKey(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('issue');
      window.history.pushState({}, '', url.toString());
    }
  };

  return (
    <div className="space-y-6">
      {/* Issues Table */}
      <IssueTable
        issues={data || DEMO_ISSUES}
        isLoading={isLoading}
        onSelectIssue={handleSelectIssue}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
      />

      {/* Universal Slide-Over Drawer */}
      <IssueDrawer
        issueIdentifier={selectedIssueKey}
        onClose={handleCloseDrawer}
      />

      {/* Create Issue Modal */}
      <CreateIssueModal
        projectId={projectId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(key) => handleSelectIssue(key)}
      />
    </div>
  );
}

export function IssuesView(props: IssuesViewContentProps) {
  return (
    <Suspense fallback={<div className="h-64 flex items-center justify-center text-xs text-muted-foreground">Loading issue view...</div>}>
      <IssuesViewContent {...props} />
    </Suspense>
  );
}
