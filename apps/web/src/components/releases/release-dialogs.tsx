'use client';

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Rocket,
  Flag,
  ShieldAlert,
  CheckCircle2,
  FileText,
  Sparkles,
  Eye,
  Pencil,
  Copy,
  Check,
  Loader2,
  XCircle,
} from 'lucide-react';
import { api, ReadinessCheck, ReleaseReadinessReport, ReleaseSummary, MilestoneSummary } from '@/lib/api';
import {
  DialogShell,
  ErrorNote,
  PrimaryButton,
  CancelButton,
  inputClass,
  labelClass,
} from '../common/dialog-primitives';
import { GenerativeMarkdown } from '../ai/generative-markdown';
import { toDateInputValue, fromDateInputValue } from '../sprints/sprint-utils';
import { VERDICT_META } from './release-utils';
import { cn } from '@/lib/utils';

function invalidatePlanning(queryClient: ReturnType<typeof useQueryClient>, projectId: string) {
  queryClient.invalidateQueries({ queryKey: ['releases', projectId] });
  queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
  queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
}

// ---------------------------------------------------------------------------
// Release create / edit
// ---------------------------------------------------------------------------

export function ReleaseFormDialog({
  projectId,
  open,
  release,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  release: ReleaseSummary | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [version, setVersion] = useState('');
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setVersion(release?.version ?? '');
    setName(release && release.name !== release.version ? release.name : '');
    setTargetDate(toDateInputValue(release?.targetDate));
    setDescription(release?.description ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, release?.id]);

  const mutation = useMutation({
    mutationFn: () =>
      release
        ? api.updateRelease(release.id, {
            version: version.trim(),
            name: name.trim() || version.trim(),
            targetDate: fromDateInputValue(targetDate) ?? null,
            description: description.trim() || null,
          })
        : api.createRelease(projectId, {
            version: version.trim(),
            name: name.trim() || undefined,
            targetDate: fromDateInputValue(targetDate),
            description: description.trim() || undefined,
          }),
    onSuccess: () => {
      invalidatePlanning(queryClient, projectId);
      onOpenChange(false);
    },
  });

  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next) mutation.reset();
        onOpenChange(next);
      }}
      icon={<Rocket className="h-4 w-4" />}
      title={release ? `Edit ${release.version}` : 'Create release'}
      description={release ? undefined : 'Group issues into a shippable version, then track its readiness.'}
      footer={
        <>
          <CancelButton onClick={() => onOpenChange(false)} />
          <PrimaryButton pending={mutation.isPending} disabled={!version.trim()} onClick={() => mutation.mutate()}>
            {release ? 'Save changes' : 'Create release'}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="release-version">Version</label>
          <input
            id="release-version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="v2.4.0"
            maxLength={50}
            className={cn(inputClass, 'font-mono')}
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="release-target">Target date</label>
          <input id="release-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className={labelClass} htmlFor="release-name">Name</label>
        <input
          id="release-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Defaults to the version (e.g. Multi-currency checkout)"
          maxLength={255}
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label className={labelClass} htmlFor="release-description">Description</label>
        <textarea
          id="release-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={5000}
          placeholder="What does this release deliver?"
          className={cn(inputClass, 'resize-none')}
        />
      </div>
      <ErrorNote error={mutation.error} />
    </DialogShell>
  );
}

// ---------------------------------------------------------------------------
// Milestone create / edit
// ---------------------------------------------------------------------------

export function MilestoneFormDialog({
  projectId,
  open,
  milestone,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  milestone: MilestoneSummary | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(milestone?.name ?? '');
    setTargetDate(toDateInputValue(milestone?.targetDate));
    setDescription(milestone?.description ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, milestone?.id]);

  const mutation = useMutation({
    mutationFn: () =>
      milestone
        ? api.updateMilestone(milestone.id, {
            name: name.trim(),
            targetDate: fromDateInputValue(targetDate) ?? null,
            description: description.trim() || null,
          })
        : api.createMilestone(projectId, {
            name: name.trim(),
            targetDate: fromDateInputValue(targetDate),
            description: description.trim() || undefined,
          }),
    onSuccess: () => {
      invalidatePlanning(queryClient, projectId);
      onOpenChange(false);
    },
  });

  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next) mutation.reset();
        onOpenChange(next);
      }}
      icon={<Flag className="h-4 w-4" />}
      title={milestone ? `Edit ${milestone.name}` : 'Create milestone'}
      description={milestone ? undefined : 'A cross-sprint goal. Progress and slip risk are tracked from its issues.'}
      footer={
        <>
          <CancelButton onClick={() => onOpenChange(false)} />
          <PrimaryButton pending={mutation.isPending} disabled={!name.trim()} onClick={() => mutation.mutate()}>
            {milestone ? 'Save changes' : 'Create milestone'}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="milestone-name">Name</label>
          <input
            id="milestone-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mobile App Beta"
            maxLength={255}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="milestone-target">Target date</label>
          <input id="milestone-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className={labelClass} htmlFor="milestone-description">Description</label>
        <textarea
          id="milestone-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={5000}
          placeholder="What does reaching this milestone mean?"
          className={cn(inputClass, 'resize-none')}
        />
      </div>
      <ErrorNote error={mutation.error} />
    </DialogShell>
  );
}

// ---------------------------------------------------------------------------
// Readiness gate override (READY_FOR_RELEASE)
// ---------------------------------------------------------------------------

export function FailingChecksList({ checks }: { checks: ReadinessCheck[] }) {
  const failing = checks.filter((c) => c.status === 'FAIL');
  if (failing.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {failing.map((check) => (
        <li key={check.id} className="flex items-start gap-2 text-xs rounded-md border border-red-500/25 bg-red-500/5 px-3 py-2">
          <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold text-foreground">{check.label}.</span>{' '}
            <span className="text-muted-foreground">{check.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ReadinessGateDialog({
  release,
  report,
  pending,
  error,
  onConfirm,
  onOpenChange,
}: {
  release: ReleaseSummary | null;
  report: ReleaseReadinessReport | null;
  pending: boolean;
  error: unknown;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DialogShell
      open={Boolean(release && report)}
      onOpenChange={onOpenChange}
      icon={<ShieldAlert className="h-4 w-4" />}
      title={`${release?.version ?? 'Release'} is not ready`}
      description="Critical readiness checks fail. You can still mark it ready; the override is recorded in the activity log."
      footer={
        <>
          <CancelButton onClick={() => onOpenChange(false)} label="Keep in progress" />
          <PrimaryButton tone="danger" pending={pending} onClick={onConfirm}>
            Mark ready anyway
          </PrimaryButton>
        </>
      }
    >
      {report && <FailingChecksList checks={report.checks} />}
      <ErrorNote error={error} />
    </DialogShell>
  );
}

// ---------------------------------------------------------------------------
// Ship (→ RELEASED)
// ---------------------------------------------------------------------------

export function ShipReleaseDialog({
  projectId,
  release,
  rolloverCandidates,
  onOpenChange,
}: {
  projectId: string;
  release: ReleaseSummary | null;
  /** Other unreleased versions that can receive unfinished work. */
  rolloverCandidates: ReleaseSummary[];
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<'RELEASE' | 'NONE'>('NONE');
  const [targetId, setTargetId] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  const { data: readiness, isLoading: readinessLoading } = useQuery({
    queryKey: ['release-readiness', release?.id],
    queryFn: () => api.getReleaseReadiness(release!.id),
    enabled: Boolean(release),
    staleTime: 0,
  });

  useEffect(() => {
    if (!release) return;
    // Default to the next version, mirroring sprint rollover
    const next = rolloverCandidates[0];
    setTarget(next ? 'RELEASE' : 'NONE');
    setTargetId(next?.id ?? '');
    setAcknowledged(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [release?.id]);

  const mutation = useMutation({
    mutationFn: () =>
      api.shipRelease(release!.id, {
        rolloverTo: target,
        rolloverReleaseId: target === 'RELEASE' ? targetId : undefined,
        acknowledgeRisks: acknowledged || undefined,
      }),
    onSuccess: () => {
      invalidatePlanning(queryClient, projectId);
      onOpenChange(false);
    },
  });

  const progress = release?.progress;
  const unfinished = progress ? progress.issueCount - progress.doneIssueCount : 0;
  const criticalFailures = readiness?.criticalFailureCount ?? 0;

  return (
    <DialogShell
      open={Boolean(release)}
      onOpenChange={(next) => {
        if (!next) mutation.reset();
        onOpenChange(next);
      }}
      icon={<Rocket className="h-4 w-4" />}
      title={`Ship ${release?.version ?? 'release'}`}
      description="Marks the release as shipped and records what went out."
      footer={
        <>
          <CancelButton onClick={() => onOpenChange(false)} />
          <PrimaryButton
            tone={criticalFailures > 0 ? 'danger' : 'success'}
            pending={mutation.isPending}
            disabled={readinessLoading || (criticalFailures > 0 && !acknowledged) || (target === 'RELEASE' && !targetId)}
            onClick={() => mutation.mutate()}
          >
            <Rocket className="h-3.5 w-3.5" />
            {criticalFailures > 0 ? 'Ship anyway' : 'Ship release'}
          </PrimaryButton>
        </>
      }
    >
      {progress && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-border bg-muted/20 py-2.5">
            <div className="text-lg font-bold text-emerald-400">{progress.doneIssueCount}</div>
            <div className="text-[10px] text-muted-foreground">issues shipping</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 py-2.5">
            <div className={cn('text-lg font-bold', unfinished > 0 ? 'text-amber-400' : '')}>{unfinished}</div>
            <div className="text-[10px] text-muted-foreground">unfinished</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 py-2.5">
            {readinessLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
            ) : (
              <div className={cn('text-lg font-bold', readiness ? VERDICT_META[readiness.verdict].className : '')}>
                {readiness?.score ?? '—'}%
              </div>
            )}
            <div className="text-[10px] text-muted-foreground">readiness</div>
          </div>
        </div>
      )}

      {readiness && criticalFailures > 0 && (
        <div className="space-y-2">
          <FailingChecksList checks={readiness.checks} />
          <label className="flex items-start gap-2 text-xs cursor-pointer rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 accent-amber-500"
            />
            <span>I understand these risks and want to ship anyway. The override is recorded in the activity log.</span>
          </label>
        </div>
      )}

      {unfinished > 0 ? (
        <fieldset className="space-y-2">
          <legend className={cn(labelClass, 'mb-1.5')}>Move {unfinished} unfinished issue(s) to</legend>
          <label
            className={cn(
              'flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors',
              target === 'RELEASE' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
              rolloverCandidates.length === 0 && 'opacity-50 cursor-not-allowed',
            )}
          >
            <input
              type="radio"
              name="release-rollover"
              checked={target === 'RELEASE'}
              disabled={rolloverCandidates.length === 0}
              onChange={() => setTarget('RELEASE')}
              className="mt-0.5 accent-[hsl(var(--primary))]"
            />
            <div className="flex-1 space-y-1.5">
              <span className="text-sm font-medium">Another release</span>
              {rolloverCandidates.length > 0 ? (
                <select
                  value={targetId}
                  onChange={(e) => {
                    setTargetId(e.target.value);
                    setTarget('RELEASE');
                  }}
                  className={cn(inputClass, 'py-1.5 text-xs')}
                >
                  {rolloverCandidates.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.version} · {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[11px] text-muted-foreground">No other unreleased versions. Create one first.</p>
              )}
            </div>
          </label>
          <label
            className={cn(
              'flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors',
              target === 'NONE' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
            )}
          >
            <input
              type="radio"
              name="release-rollover"
              checked={target === 'NONE'}
              onChange={() => setTarget('NONE')}
              className="accent-[hsl(var(--primary))]"
            />
            <span className="text-sm font-medium">No release (unassign)</span>
          </label>
        </fieldset>
      ) : (
        progress &&
        progress.issueCount > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Every issue in this release is done.
          </p>
        )
      )}

      <ErrorNote error={mutation.error} />
    </DialogShell>
  );
}

// ---------------------------------------------------------------------------
// Release notes
// ---------------------------------------------------------------------------

export function ReleaseNotesDialog({
  projectId,
  release,
  onOpenChange,
  onOpenIssue,
}: {
  projectId: string;
  release: ReleaseSummary | null;
  onOpenChange: (open: boolean) => void;
  onOpenIssue?: (issueKey: string) => void;
}) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'edit' | 'preview'>('preview');
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!release) return;
    setNotes(release.releaseNotes ?? '');
    setMode(release.releaseNotes ? 'preview' : 'edit');
    setModelUsed(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [release?.id]);

  const generateMutation = useMutation({
    mutationFn: () => api.generateReleaseNotes(release!.id),
    onSuccess: (draft) => {
      setNotes(draft.markdown);
      setModelUsed(draft.modelUsed);
      setMode('preview');
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => api.updateRelease(release!.id, { releaseNotes: notes.trim() ? notes : null }),
    onSuccess: () => {
      invalidatePlanning(queryClient, projectId);
      onOpenChange(false);
    },
  });

  const dirty = notes !== (release?.releaseNotes ?? '');

  return (
    <DialogShell
      open={Boolean(release)}
      onOpenChange={(next) => {
        if (!next) {
          generateMutation.reset();
          saveMutation.reset();
        }
        onOpenChange(next);
      }}
      size="lg"
      icon={<FileText className="h-4 w-4" />}
      title={`Release notes · ${release?.version ?? ''}`}
      description="Generated from done issues and grouped by type. Edit freely; nothing is saved until you click Save."
      footer={
        <>
          <CancelButton onClick={() => onOpenChange(false)} />
          <PrimaryButton pending={saveMutation.isPending} disabled={!dirty} onClick={() => saveMutation.mutate()}>
            Save notes
          </PrimaryButton>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/30">
          {(['edit', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors',
                mode === m ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'edit' ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {m === 'edit' ? 'Edit' : 'Preview'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {modelUsed && <span className="text-[10px] text-muted-foreground font-mono">{modelUsed}</span>}
          <button
            type="button"
            disabled={!notes}
            onClick={async () => {
              await navigator.clipboard.writeText(notes);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy Markdown'}
          </button>
          <button
            type="button"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-60 transition-colors"
          >
            {generateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {notes ? 'Regenerate with AI' : 'Generate with AI'}
          </button>
        </div>
      </div>

      {mode === 'edit' ? (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={14}
          placeholder="# v2.4.0&#10;&#10;## Features&#10;- ..."
          className={cn(inputClass, 'font-mono text-xs leading-relaxed resize-y min-h-[240px]')}
        />
      ) : (
        <div className="min-h-[240px] rounded-lg border border-border bg-muted/10 p-4">
          {notes ? (
            <GenerativeMarkdown content={notes} onOpenIssue={onOpenIssue} />
          ) : (
            <p className="text-xs text-muted-foreground text-center pt-16">
              No notes yet. Generate a draft from this release&apos;s done issues.
            </p>
          )}
        </div>
      )}

      <ErrorNote error={generateMutation.error ?? saveMutation.error} />
    </DialogShell>
  );
}
