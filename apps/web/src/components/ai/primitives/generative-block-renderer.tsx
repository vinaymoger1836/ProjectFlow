'use client';

import React from 'react';
import { GenerativeBlock } from '@/lib/api';
import { GenerativeStatGrid } from './generative-stat-grid';
import { GenerativeChart } from './generative-chart';
import { GenerativeTable } from './generative-table';
import { GenerativeProfileCard } from './generative-profile-card';
import { GenerativeIssueList } from '../generative-issue-list';
import { GenerativeMetricsCard } from '../generative-metrics-card';
import { GenerativeIssueCard } from '../generative-issue-card';

interface GenerativeBlockRendererProps {
  block: GenerativeBlock;
  projectId?: string;
  onOpenIssueInDrawer?: (issueKey: string) => void;
}

export function GenerativeBlockRenderer({
  block,
  projectId = '11111111-1111-1111-1111-111111111111',
  onOpenIssueInDrawer,
}: GenerativeBlockRendererProps) {
  if (!block || !block.type) return null;

  switch (block.type) {
    case 'stat_grid':
      return <GenerativeStatGrid block={block} />;

    case 'chart':
      return <GenerativeChart block={block} />;

    case 'table':
      return <GenerativeTable block={block} onOpenIssueInDrawer={onOpenIssueInDrawer} />;

    case 'profile_card':
      return <GenerativeProfileCard block={block} />;

    case 'issue_list':
      return <GenerativeIssueList widget={block} onOpenIssueInDrawer={onOpenIssueInDrawer} />;

    case 'metrics':
      return <GenerativeMetricsCard widget={block} />;

    case 'proposal_card':
      return (
        <GenerativeIssueCard
          projectId={projectId}
          initialDraft={block.draft}
          onIssueCreated={onOpenIssueInDrawer}
        />
      );

    default:
      return null;
  }
}
