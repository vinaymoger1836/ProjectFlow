'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Rocket,
  Flag,
  ShieldCheck,
  FileText,
  Pencil,
  Trash2,
  CalendarClock,
  ChevronDown,
  History,
  Play,
  CheckCircle2,
  AlertTriangle,
  X,
  Bug,
  Ban,
  CircleDashed,
  TrendingUp,
} from 'lucide-react';
import {
  api,
  isReadinessGateError,
  MilestoneSummary,
  PaginatedIssues,
  ReleaseReadinessReport,
  ReleaseStatus,
  ReleaseSummary,
  WorkProgress,
} from '@/lib/api';
import { useProjectSocket } from '@/lib/use-socket';
import { IssueTypeBadge, IssueStatusBadge, IssuePriorityBadge } from '../issues/badge-helpers';
import { daysRemaining } from '../sprints/sprint-utils';
import {
  ReleaseFormDialog,
  MilestoneFormDialog,
  ShipReleaseDialog,
  ReadinessGateDialog,
  ReleaseNotesDialog,
} from './release-dialogs';
import { ReleaseReadinessDialog, ScoreRing } from './release-readiness-dialog';
import { RELEASE_STATUS_META, MILESTONE_HEALTH_META, VERDICT_META, NEXT_STATUS, formatDate } from './release-utils';
import { cn } from '@/lib/utils';

type PlanningIssue = PaginatedIssues['items'][number];

interface ReleasesViewProps {
  projectId: string;
  onSelectIssue: (issueKey: string) => void;
}

export function ReleasesView({ projectId, onSelectIssue }: ReleasesViewProps) {
  const queryClient = useQueryClient();
  useProjectSocket(projectId);

  const { data: releases = [], isLoading: releasesLoading } = useQuery({
    queryKey: ['releases', projectId],
    queryFn: () => api.listReleases(projectId),
  });
  const { data: milestones = [], isLoading: milestonesLoading } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: () => api.listMilestones(projectId),
  });
  const { data: allIssues = [] } = useQuery({
    queryKey: ['issues', projectId, 'planning-all'],
    queryFn: async () => (await api.listAllIssues(projectId)).filter((i) => i.type !== 'SUBTASK'),
  });

  const [releaseForm, setReleaseForm] = useState<{ open: boolean; release: ReleaseSummary | null }>({ open: false, release: null });
  const [milestoneForm, setMilestoneForm] = useState<{ open: boolean; milestone: MilestoneSummary | null }>({ open: false, milestone: null });
  const [readinessTarget, setReadinessTarget] = useState<ReleaseSummary | null>(null);
  const [notesTarget, setNotesTarget] = useState<ReleaseSummary | null>(null);
  const [shipTarget, setShipTarget] = useState<ReleaseSummary | null>(null);
  const [gate, setGate] = useState<{ release: ReleaseSummary; report: ReleaseReadinessReport } | null>(null);
  const [showShipped, setShowShipped] = useState(false);

  const openReleases = releases.filter((r) => r.status !== 'RELEASED');
  const shippedReleases = releases.filter((r) => r.status === 'RELEASED');

  const { byRelease, byMilestone } = useMemo(() => {
    const releaseMap = new Map<string, PlanningIssue[]>();
    const milestoneMap = new Map<string, PlanningIssue[]>();
    for (const issue of allIssues) {
      if (issue.releaseId) releaseMap.set(issue.releaseId, [...(releaseMap.get(issue.releaseId) ?? []), issue]);
      if (issue.milestoneId) milestoneMap.set(issue.milestoneId, [...(milestoneMap.get(issue.milestoneId) ?? []), issue]);
    }
    return { byRelease: releaseMap, byMilestone: milestoneMap };
  }, [allIssues]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['releases', projectId] });
    queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
    queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
  };

  const statusMutation = useMutation({
    mutationFn: (input: { release: ReleaseSummary; status: Exclude<ReleaseStatus, 'RELEASED'>; acknowledgeRisks?: boolean }) =>
      api.updateReleaseStatus(input.release.id, { status: input.status, acknowledgeRisks: input.acknowledgeRisks }),
    onSuccess: () => {
      setGate(null);
      invalidate();
    },
    onError: (err, input) => {
      // The gate refused the transition: show what fails and let the user override explicitly
      if (isReadinessGateError(err)) setGate({ release: input.release, report: err.body.readiness });
    },
  });

  const deleteRelease = useMutation({ mutationFn: (id: string) => api.deleteRelease(id), onSuccess: invalidate });
  const deleteMilestone = useMutation({ mutationFn: (id: string) => api.deleteMilestone(id), onSuccess: invalidate });

  const pageError =
    (statusMutation.error && !isReadinessGateError(statusMutation.error) ? statusMutation.error : null) ??
    deleteRelease.error ??
    deleteMilestone.error;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/70 border border-border/80 rounded-xl p-3.5">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{openReleases.length}</span> upcoming release
            {openReleases.length === 1 ? '' : 's'}
          </span>
          <span>
            <span className="font-semibold text-foreground">{milestones.length}</span> milestone{milestones.length === 1 ? '' : 's'}
          </span>
          {milestones.some((m) => m.health === 'AT_RISK' || m.health === 'OVERDUE') && (
            <span className="inline-flex items-center gap-1 text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {milestones.filter((m) => m.health === 'AT_RISK' || m.health === 'OVERDUE').length} slipping
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMilestoneForm({ open: true, milestone: null })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border bg-card hover:bg-muted transition-colors"
          >
            <Flag className="h-3.5 w-3.5" />
            New milestone
          </button>
          <button
            type="button"
            onClick={() => setReleaseForm({ open: true, release: null })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New release
          </button>
        </div>
      </div>

      {pageError && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="flex-1">{pageError instanceof Error ? pageError.message : 'Something went wrong.'}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              statusMutation.reset();
              deleteRelease.reset();
              deleteMilestone.reset();
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Releases */}
      <section className="space-y-3">
        <SectionHeading icon={<Rocket className="h-4 w-4 text-primary" />} title="Releases" />
        {releasesLoading ? (
          <Skeleton count={2} />
        ) : openReleases.length === 0 ? (
          <EmptyState
            icon={<Rocket className="h-6 w-6 text-primary mx-auto" />}
            title="No upcoming releases"
            text="Create a release, then assign issues from the issue drawer or bulk-select them in the Issues table."
          />
        ) : (
          openReleases.map((release) => (
            <ReleaseCard
              key={release.id}
              release={release}
              issues={byRelease.get(release.id) ?? []}
              onSelectIssue={onSelectIssue}
              onEdit={() => setReleaseForm({ open: true, release })}
              onDelete={() => deleteRelease.mutate(release.id)}
              onReadiness={() => setReadinessTarget(release)}
              onNotes={() => setNotesTarget(release)}
              onShip={() => setShipTarget(release)}
              onAdvance={(status) => statusMutation.mutate({ release, status })}
              onReopen={() => statusMutation.mutate({ release, status: 'IN_PROGRESS' })}
              isAdvancing={statusMutation.isPending && statusMutation.variables?.release.id === release.id}
            />
          ))
        )}

        {shippedReleases.length > 0 && (
          <div className="rounded-xl border border-border/70 bg-card/50">
            <button
              type="button"
              onClick={() => setShowShipped((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <History className="h-3.5 w-3.5" />
                Shipped releases ({shippedReleases.length})
              </span>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showShipped && 'rotate-180')} />
            </button>
            {showShipped && (
              <ul className="border-t border-border divide-y divide-border/60 animate-fade-in">
                {shippedReleases.map((r) => (
                  <li key={r.id} className="flex items-center gap-4 px-4 py-2.5 text-xs">
                    <span className="font-mono font-semibold w-24 truncate">{r.version}</span>
                    <span className="flex-1 truncate text-muted-foreground">{r.name !== r.version ? r.name : ''}</span>
                    <span className="text-muted-foreground w-28">{formatDate(r.releasedAt)}</span>
                    <span className="text-muted-foreground w-36 text-right">
                      {r.shippedIssueCount ?? 0} shipped
                      {r.carriedOverIssueCount ? ` · ${r.carriedOverIssueCount} carried` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotesTarget(r)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <FileText className="h-3 w-3" />
                      Notes
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Milestones */}
      <section className="space-y-3">
        <SectionHeading icon={<Flag className="h-4 w-4 text-primary" />} title="Milestones" />
        {milestonesLoading ? (
          <Skeleton count={1} />
        ) : milestones.length === 0 ? (
          <EmptyState
            icon={<Flag className="h-6 w-6 text-primary mx-auto" />}
            title="No milestones"
            text="Milestones track cross-sprint goals and warn when their target date is slipping."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {milestones.map((milestone) => (
              <MilestoneCard
                key={milestone.id}
                milestone={milestone}
                issues={byMilestone.get(milestone.id) ?? []}
                onSelectIssue={onSelectIssue}
                onEdit={() => setMilestoneForm({ open: true, milestone })}
                onDelete={() => deleteMilestone.mutate(milestone.id)}
              />
            ))}
          </div>
        )}
      </section>

      <ReleaseFormDialog
        projectId={projectId}
        open={releaseForm.open}
        release={releaseForm.release}
        onOpenChange={(open) => setReleaseForm((s) => ({ ...s, open }))}
      />
      <MilestoneFormDialog
        projectId={projectId}
        open={milestoneForm.open}
        milestone={milestoneForm.milestone}
        onOpenChange={(open) => setMilestoneForm((s) => ({ ...s, open }))}
      />
      <ReleaseReadinessDialog
        projectId={projectId}
        release={readinessTarget}
        onOpenChange={(open) => !open && setReadinessTarget(null)}
        onOpenIssue={(key) => {
          setReadinessTarget(null);
          onSelectIssue(key);
        }}
      />
      <ReleaseNotesDialog
        projectId={projectId}
        release={notesTarget}
        onOpenChange={(open) => !open && setNotesTarget(null)}
        onOpenIssue={(key) => {
          setNotesTarget(null);
          onSelectIssue(key);
        }}
      />
      <ShipReleaseDialog
        projectId={projectId}
        release={shipTarget}
        rolloverCandidates={openReleases.filter((r) => r.id !== shipTarget?.id)}
        onOpenChange={(open) => !open && setShipTarget(null)}
      />
      <ReadinessGateDialog
        release={gate?.release ?? null}
        report={gate?.report ?? null}
        pending={statusMutation.isPending}
        error={statusMutation.error && !isReadinessGateError(statusMutation.error) ? statusMutation.error : null}
        onConfirm={() => gate && statusMutation.mutate({ release: gate.release, status: 'READY_FOR_RELEASE', acknowledgeRisks: true })}
        onOpenChange={(open) => {
          if (!open) {
            setGate(null);
            statusMutation.reset();
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ReleaseCard({
  release,
  issues,
  onSelectIssue,
  onEdit,
  onDelete,
  onReadiness,
  onNotes,
  onShip,
  onAdvance,
  onReopen,
  isAdvancing,
}: {
  release: ReleaseSummary;
  issues: PlanningIssue[];
  onSelectIssue: (key: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onReadiness: () => void;
  onNotes: () => void;
  onShip: () => void;
  onAdvance: (status: Exclude<ReleaseStatus, 'RELEASED'>) => void;
  onReopen: () => void;
  isAdvancing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = RELEASE_STATUS_META[release.status];
  const next = NEXT_STATUS[release.status];
  const remaining = daysRemaining(release.targetDate);
  const { progress } = release;

  const { data: readiness } = useQuery({
    // Lives under the release list key so issue and release events refresh it
    queryKey: ['releases', release.projectId, 'readiness', release.id],
    queryFn: () => api.getReleaseReadiness(release.id),
    staleTime: 30_000,
  });

  return (
    <article
      className={cn(
        'rounded-xl border bg-card shadow-sm transition-colors',
        release.status === 'READY_FOR_RELEASE' ? 'border-emerald-500/30' : 'border-border',
      )}
    >
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {release.version}
              </span>
              {release.name !== release.version && <h3 className="text-sm font-semibold">{release.name}</h3>}
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', status.className)}>
                {status.label}
              </span>
              {release.targetDate && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  {formatDate(release.targetDate)}
                  {remaining !== null && (
                    <span className={cn('ml-0.5', remaining < 0 ? 'text-red-400' : remaining <= 3 ? 'text-amber-400' : '')}>
                      · {remaining < 0 ? `${Math.abs(remaining)}d overdue` : `${remaining}d left`}
                    </span>
                  )}
                </span>
              )}
            </div>
            {release.description && <p className="text-xs text-muted-foreground line-clamp-2">{release.description}</p>}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {confirmDelete ? (
              <>
                <span className="text-[11px] text-muted-foreground mr-1">Delete release?</span>
                <button type="button" onClick={onDelete} className="px-2 py-1 rounded text-[11px] font-semibold bg-destructive/15 text-destructive hover:bg-destructive/25">
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded text-[11px] text-muted-foreground hover:bg-muted">
                  Keep
                </button>
              </>
            ) : (
              <>
                <IconButton title="Release notes" onClick={onNotes}>
                  <FileText className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton title="Edit release" onClick={onEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton title="Delete release" danger onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
                <button
                  type="button"
                  onClick={onReadiness}
                  className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Readiness
                </button>
                {release.status === 'READY_FOR_RELEASE' && (
                  <button
                    type="button"
                    onClick={onReopen}
                    disabled={isAdvancing}
                    title="Move back to in progress"
                    className="px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    Reopen
                  </button>
                )}
                {next ? (
                  <button
                    type="button"
                    onClick={() => onAdvance(next.status)}
                    disabled={isAdvancing}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                  >
                    {next.status === 'IN_PROGRESS' ? <Play className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {next.label}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onShip}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                  >
                    <Rocket className="h-3.5 w-3.5" />
                    Ship
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0 space-y-1.5">
            <ProgressBar progress={progress} barClass="bg-primary" />
            <ProgressChips progress={progress} extra={release.milestoneCount > 0 ? `${release.milestoneCount} milestone${release.milestoneCount === 1 ? '' : 's'}` : undefined} />
          </div>
          {readiness && (
            <button
              type="button"
              onClick={onReadiness}
              title="Open readiness report"
              className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted/60 transition-colors"
            >
              <ScoreRing score={readiness.score} ringClass={VERDICT_META[readiness.verdict].ring} size={40} />
              <span className={cn('text-[11px] font-semibold', VERDICT_META[readiness.verdict].className)}>
                {VERDICT_META[readiness.verdict].label}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-border">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>{issues.length} issue{issues.length === 1 ? '' : 's'} in scope</span>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>
        {expanded && (
          <IssueRows
            issues={issues}
            onSelectIssue={onSelectIssue}
            emptyText="No issues yet. Assign them from the issue drawer or bulk-edit in the Issues table."
          />
        )}
      </div>
    </article>
  );
}

function MilestoneCard({
  milestone,
  issues,
  onSelectIssue,
  onEdit,
  onDelete,
}: {
  milestone: MilestoneSummary;
  issues: PlanningIssue[];
  onSelectIssue: (key: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const health = MILESTONE_HEALTH_META[milestone.health];
  const projected = formatDate(milestone.projectedCompletionDate);

  return (
    <article className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Flag className="h-3.5 w-3.5 text-primary shrink-0" />
            <h3 className="text-sm font-semibold truncate">{milestone.name}</h3>
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', health.className)}>{health.label}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            {milestone.targetDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                Target {formatDate(milestone.targetDate)}
              </span>
            )}
            {projected && milestone.health !== 'COMPLETED' && (
              <span
                className={cn(
                  'inline-flex items-center gap-1',
                  milestone.slipDays !== null && milestone.slipDays > 0 ? 'text-amber-400' : '',
                )}
              >
                <TrendingUp className="h-3 w-3" />
                Forecast {projected}
                {milestone.slipDays !== null && milestone.slipDays > 0 && ` (+${milestone.slipDays}d)`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {confirmDelete ? (
            <>
              <button type="button" onClick={onDelete} className="px-2 py-1 rounded text-[11px] font-semibold bg-destructive/15 text-destructive hover:bg-destructive/25">
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded text-[11px] text-muted-foreground hover:bg-muted">
                Keep
              </button>
            </>
          ) : (
            <>
              <IconButton title="Edit milestone" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton title="Delete milestone" danger onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </>
          )}
        </div>
      </div>

      <ProgressBar progress={milestone.progress} barClass={health.bar} />
      <p className="text-xs text-muted-foreground">{milestone.healthReason}</p>
      <ProgressChips progress={milestone.progress} />

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between pt-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{issues.length} issue{issues.length === 1 ? '' : 's'}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="-mx-2">
          <IssueRows issues={issues} onSelectIssue={onSelectIssue} emptyText="No issues are tied to this milestone yet." />
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------

function ProgressBar({ progress, barClass }: { progress: WorkProgress; barClass: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative h-1.5 flex-1 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.completionPercentage}
        aria-label="Issues done"
      >
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out', barClass)}
          style={{ width: `${progress.completionPercentage}%` }}
        />
      </div>
      <span className="text-[11px] font-mono font-semibold text-muted-foreground tabular-nums shrink-0">
        {progress.doneIssueCount}/{progress.issueCount} · {progress.donePoints}/{progress.totalPoints} pts
      </span>
    </div>
  );
}

function ProgressChips({ progress, extra }: { progress: WorkProgress; extra?: string }) {
  const chips: { key: string; text: string; icon: React.ReactNode; className: string }[] = [];
  if (progress.openCriticalBugCount > 0)
    chips.push({ key: 'bugs', text: `${progress.openCriticalBugCount} P0/P1 bug${progress.openCriticalBugCount === 1 ? '' : 's'}`, icon: <Bug className="h-3 w-3" />, className: 'text-red-400' });
  if (progress.blockedCount > 0)
    chips.push({ key: 'blocked', text: `${progress.blockedCount} blocked`, icon: <Ban className="h-3 w-3" />, className: 'text-red-400' });
  if (progress.unestimatedCount > 0)
    chips.push({ key: 'est', text: `${progress.unestimatedCount} unestimated`, icon: <CircleDashed className="h-3 w-3" />, className: 'text-amber-400' });
  if (extra) chips.push({ key: 'extra', text: extra, icon: <Flag className="h-3 w-3" />, className: 'text-muted-foreground' });
  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-3 text-[11px] flex-wrap">
      {chips.map((chip) => (
        <span key={chip.key} className={cn('inline-flex items-center gap-1', chip.className)}>
          {chip.icon}
          {chip.text}
        </span>
      ))}
    </div>
  );
}

function IssueRows({ issues, onSelectIssue, emptyText }: { issues: PlanningIssue[]; onSelectIssue: (key: string) => void; emptyText: string }) {
  if (issues.length === 0) {
    return <p className="px-4 pb-4 pt-1 text-center text-xs text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="px-1.5 pb-1.5 space-y-0.5 animate-fade-in">
      {issues.map((issue) => (
        <li key={issue.id}>
          <button
            type="button"
            onClick={() => onSelectIssue(issue.issueKey)}
            className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
          >
            <IssueTypeBadge type={issue.type} className="text-[10px] py-0 px-1.5 shrink-0" />
            <span className="font-mono text-[11px] font-semibold text-muted-foreground w-16 shrink-0">{issue.issueKey}</span>
            <span className={cn('text-sm truncate flex-1', issue.status === 'DONE' && 'line-through text-muted-foreground')}>
              {issue.title}
            </span>
            <IssueStatusBadge status={issue.status} className="text-[10px] py-0 shrink-0 hidden md:inline-flex" />
            <IssuePriorityBadge priority={issue.priority} className="text-[10px] py-0 px-1.5 shrink-0" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function IconButton({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        'p-1.5 rounded-md text-muted-foreground transition-colors',
        danger ? 'hover:text-destructive hover:bg-destructive/10' : 'hover:text-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-8 text-center space-y-2">
      {icon}
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto">{text}</p>
    </div>
  );
}

function Skeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-32 rounded-xl border border-border/60 bg-muted/20 animate-pulse" />
      ))}
    </div>
  );
}
