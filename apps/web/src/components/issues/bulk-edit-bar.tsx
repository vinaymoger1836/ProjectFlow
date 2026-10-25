'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitCompareArrows, X } from 'lucide-react';
import { api, BulkChangeField, BulkIssueChanges, BulkIssueOperation } from '@/lib/api';
import { BulkDiffDialog } from './bulk-diff-dialog';

const NONE = '__none__';

const FIELD_OPTIONS: { value: BulkChangeField; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'assigneeId', label: 'Assignee' },
  { value: 'sprintId', label: 'Sprint' },
  { value: 'milestoneId', label: 'Milestone' },
  { value: 'releaseId', label: 'Release' },
];

const STATUS_OPTIONS = [
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'P3', 'P4'].map((p) => ({ value: p, label: p }));

const selectClass =
  'text-xs bg-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer';

interface BulkEditBarProps {
  projectId: string;
  selectedIds: string[];
  onClear: () => void;
}

/** Appears while rows are selected; builds one change for every selected issue and previews it. */
export function BulkEditBar({ projectId, selectedIds, onClear }: BulkEditBarProps) {
  const [field, setField] = useState<BulkChangeField>('releaseId');
  const [value, setValue] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const appliedRef = useRef(false);

  const needsMembers = field === 'assigneeId';
  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.listProjectMembers(projectId),
    enabled: needsMembers,
  });
  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => api.listSprints(projectId),
    enabled: field === 'sprintId',
  });
  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: () => api.listMilestones(projectId),
    enabled: field === 'milestoneId',
  });
  const { data: releases = [] } = useQuery({
    queryKey: ['releases', projectId],
    queryFn: () => api.listReleases(projectId),
    enabled: field === 'releaseId',
  });

  const valueOptions = useMemo(() => {
    switch (field) {
      case 'status':
        return STATUS_OPTIONS;
      case 'priority':
        return PRIORITY_OPTIONS;
      case 'assigneeId':
        return [{ value: NONE, label: 'Unassigned' }, ...members.map((m) => ({ value: m.id, label: m.name }))];
      case 'sprintId':
        return [
          { value: NONE, label: 'Backlog (no sprint)' },
          ...sprints
            .filter((s) => s.status === 'PLANNED' || s.status === 'ACTIVE')
            .map((s) => ({ value: s.id, label: `${s.name} (${s.status.toLowerCase()})` })),
        ];
      case 'milestoneId':
        return [{ value: NONE, label: 'No milestone' }, ...milestones.map((m) => ({ value: m.id, label: m.name }))];
      case 'releaseId':
        return [
          { value: NONE, label: 'No release' },
          ...releases.filter((r) => r.status !== 'RELEASED').map((r) => ({ value: r.id, label: `${r.version} · ${r.name}` })),
        ];
    }
  }, [field, members, sprints, milestones, releases]);

  const operations: BulkIssueOperation[] = useMemo(() => {
    if (!value) return [];
    const changes: BulkIssueChanges = { [field]: value === NONE ? null : value };
    return selectedIds.map((issueId) => ({ issueId, changes }));
  }, [field, value, selectedIds]);

  const fieldLabel = FIELD_OPTIONS.find((f) => f.value === field)?.label.toLowerCase();

  return (
    // Floats over the page so selecting rows never shifts the table under the cursor
    <div
      role="toolbar"
      aria-label="Bulk edit selected issues"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(860px,calc(100vw-2rem))] flex flex-wrap items-center gap-2.5 rounded-xl border border-primary/40 bg-card/95 backdrop-blur-md px-4 py-2.5 shadow-2xl animate-fade-in"
    >
      <span className="text-xs font-semibold text-primary">
        {selectedIds.length} selected
      </span>
      <span className="text-xs text-muted-foreground">Set</span>
      <select
        aria-label="Field to change"
        value={field}
        onChange={(e) => {
          setField(e.target.value as BulkChangeField);
          setValue('');
        }}
        className={selectClass}
      >
        {FIELD_OPTIONS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">to</span>
      <select aria-label="New value" value={value} onChange={(e) => setValue(e.target.value)} className={selectClass}>
        <option value="" disabled>
          Choose…
        </option>
        {valueOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={operations.length === 0}
        onClick={() => setPreviewOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-2xs"
      >
        <GitCompareArrows className="h-3.5 w-3.5" />
        Preview changes
      </button>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <X className="h-3.5 w-3.5" />
        Clear
      </button>

      <BulkDiffDialog
        projectId={projectId}
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          // Clear only once the dialog closes, so its success state stays visible
          if (!open && appliedRef.current) {
            appliedRef.current = false;
            setValue('');
            onClear();
          }
        }}
        operations={operations}
        title={`Change ${fieldLabel} for ${selectedIds.length} issue${selectedIds.length === 1 ? '' : 's'}`}
        onApplied={() => {
          appliedRef.current = true;
        }}
      />
    </div>
  );
}
