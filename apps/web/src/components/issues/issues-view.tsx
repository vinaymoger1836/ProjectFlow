'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { IssueTable } from './issue-table';
import { IssueDrawer } from './issue-drawer';
import { CreateIssueModal } from './create-issue-modal';
import { api } from '@/lib/api';

interface IssuesViewContentProps {
  projectId?: string;
}

function IssuesViewContent({
  projectId = '11111111-1111-1111-1111-111111111111',
}: IssuesViewContentProps) {
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

  // Fetch live issues directly from Cloud Supabase via NestJS API
  const { data: issues = [], isLoading } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      const res = await api.listIssues(projectId);
      return res?.items || [];
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
        issues={issues}
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
        projectName="Payment Integration Platform"
        projectKey="PAY"
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(key) => handleSelectIssue(key)}
      />
    </div>
  );
}

export function IssuesView(props: IssuesViewContentProps) {
  return (
    <Suspense
      fallback={
        <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
          Loading issue view...
        </div>
      }
    >
      <IssuesViewContent {...props} />
    </Suspense>
  );
}
