'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Kanban,
  ListTodo,
  Calendar,
  Sparkles,
  Search,
  Layers,
  Settings,
  Clock,
  Plus,
  ArrowRight,
  Rocket,
  Zap,
} from 'lucide-react';
import { IssuesView } from '@/components/issues/issues-view';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { IssueDrawer } from '@/components/issues/issue-drawer';
import { CreateIssueModal } from '@/components/issues/create-issue-modal';
import { AiCopilotSideDrawer } from '@/components/ai/ai-copilot-side-drawer';
import { SearchModal, useSearchShortcut } from '@/components/search/search-modal';
import { BacklogView } from '@/components/sprints/backlog-view';
import { ActiveSprintCard } from '@/components/sprints/active-sprint-card';
import { ReleasesView } from '@/components/releases/releases-view';
import { NextReleaseCard } from '@/components/releases/next-release-card';
import { HealthStatusCard } from '@/components/health/health-status-card';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { CommandBar, useCommandBarShortcut } from '@/components/command/command-bar';
import { AutomationsView } from '@/components/automations/automations-view';
import { useProjectSocket } from '@/lib/use-socket';
import { cn } from '@/lib/utils';

type NavTab = 'overview' | 'issues' | 'board' | 'sprints' | 'releases' | 'automations';

function HomePageContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [defaultCreateStatus, setDefaultCreateStatus] = useState<string>('TODO');
  const [createSprintId, setCreateSprintId] = useState<string | undefined>(undefined);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const projectId = '11111111-1111-1111-1111-111111111111';

  useSearchShortcut(useCallback(() => setIsSearchOpen(true), []));
  useCommandBarShortcut(useCallback(() => setIsCommandOpen(true), []));
  // Page-level connection: health and per-user notification events must arrive on every tab
  useProjectSocket(projectId);

  // Sync drawer with URL ?issue=KEY
  useEffect(() => {
    const issueParam = searchParams.get('issue');
    if (issueParam) {
      setSelectedIssueKey(issueParam);
    }
  }, [searchParams]);

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

  const handleOpenCreateModal = (status = 'TODO', sprintId?: string) => {
    setDefaultCreateStatus(status);
    setCreateSprintId(sprintId);
    setIsCreateModalOpen(true);
  };


  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col justify-between shrink-0">
        <div>
          {/* Workspace Switcher */}
          <div className="h-16 flex items-center px-6 border-b border-border gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-sm">
              P
            </div>
            <div>
              <h1 className="font-semibold text-sm leading-none">ProjectFlow</h1>
              <span className="text-xs text-muted-foreground">Acme Engineering</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <div className="text-xs font-semibold text-muted-foreground px-3 py-2 uppercase tracking-wider">
              Workspace
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors text-left',
                activeTab === 'overview'
                  ? 'bg-secondary text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <LayoutDashboard
                className={cn('h-4 w-4', activeTab === 'overview' ? 'text-primary' : '')}
              />
              <span>Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('issues')}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-md font-medium text-sm transition-colors text-left',
                activeTab === 'issues'
                  ? 'bg-secondary text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span className="flex items-center gap-3">
                <ListTodo
                  className={cn('h-4 w-4', activeTab === 'issues' ? 'text-primary' : '')}
                />
                <span>Issues & Backlog</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                4
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('board')}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors text-left',
                activeTab === 'board'
                  ? 'bg-secondary text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Kanban className={cn('h-4 w-4', activeTab === 'board' ? 'text-primary' : '')} />
              <span>Active Board</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sprints')}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors text-left',
                activeTab === 'sprints'
                  ? 'bg-secondary text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Calendar className={cn('h-4 w-4', activeTab === 'sprints' ? 'text-primary' : '')} />
              <span>Backlog & Sprints</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('releases')}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors text-left',
                activeTab === 'releases'
                  ? 'bg-secondary text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Rocket className={cn('h-4 w-4', activeTab === 'releases' ? 'text-primary' : '')} />
              <span>Releases & Milestones</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('automations')}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors text-left',
                activeTab === 'automations'
                  ? 'bg-secondary text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Zap className={cn('h-4 w-4', activeTab === 'automations' ? 'text-primary' : '')} />
              <span>Automations</span>
            </button>

            <div className="pt-4 text-xs font-semibold text-muted-foreground px-3 py-2 uppercase tracking-wider">
              AI Workflows
            </div>

            <button
              type="button"
              onClick={() => setIsCopilotOpen(!isCopilotOpen)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-md font-medium text-sm transition-colors text-left',
                isCopilotOpen
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>AI Copilot</span>
              </span>
              <span
                className={cn(
                  'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                  isCopilotOpen
                    ? 'bg-primary text-primary-foreground border-primary font-bold'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                )}
              >
                {isCopilotOpen ? 'Open' : 'Active'}
              </span>
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground font-medium text-sm transition-colors text-left"
            >
              <Layers className="h-4 w-4" />
              <span>Project Insights</span>
            </button>
          </nav>
        </div>

        {/* Bottom Settings */}
        <div className="p-4 border-t border-border">
          <button
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground font-medium text-sm transition-colors text-left"
          >
            <Settings className="h-4 w-4" />
            <span>Project Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace + Copilot Split View Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Workspace Area: Takes 55% when copilot is open, 100% when closed */}
        <main
          className={cn(
            'flex flex-col overflow-hidden transition-all duration-300 ease-in-out',
            isCopilotOpen ? 'w-full lg:w-[55%] shrink-0' : 'w-full flex-1',
          )}
        >
          {/* Top Navbar */}
          <header className="h-16 border-b border-border px-6 flex items-center justify-between bg-card/60 backdrop-blur-md shrink-0">
            {/* Issue Search Trigger */}
            <div className="flex items-center gap-2 w-[30rem]">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="flex-1 flex items-center justify-between px-3 py-1.5 text-xs bg-muted/40 border border-input rounded-md text-muted-foreground hover:border-primary transition-colors shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5" />
                  <span>Search issues and comments...</span>
                </span>
                <kbd className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border font-mono">
                  /
                </kbd>
              </button>
              {/* Global AI Command Bar trigger (Cmd/Ctrl+K) */}
              <button
                type="button"
                onClick={() => setIsCommandOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-primary/10 border border-primary/30 rounded-md text-primary font-semibold hover:bg-primary/20 transition-colors shadow-xs"
                title="Command bar: ask AI, navigate, or search (Ctrl/Cmd+K)"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Ask</span>
                <kbd className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-primary/30 font-mono">⌘K</kbd>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* AI Copilot Toggle Button in Navbar */}
              <button
                type="button"
                onClick={() => setIsCopilotOpen(!isCopilotOpen)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border shadow-xs',
                  isCopilotOpen
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20',
                )}
                title={isCopilotOpen ? 'Close AI Copilot Side Drawer' : 'Open AI Copilot (45% Side Drawer)'}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI Copilot</span>
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isCopilotOpen ? 'bg-white animate-pulse' : 'bg-emerald-400',
                  )}
                />
              </button>

              <NotificationCenter onOpenIssue={handleSelectIssue} />
              <div className="h-7 w-7 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs border border-primary/30">
                U
              </div>
            </div>
          </header>

        {/* Workspace Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Project Title Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight">Payment Integration Platform</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold border border-primary/20">
                  PAY
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Unified checkout and global payment gateway migration across multi-currency channels.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('issues')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
                  activeTab === 'issues'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border bg-card hover:bg-muted text-foreground',
                )}
              >
                <ListTodo className="h-3.5 w-3.5" />
                <span>Issues Table</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('board')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
                  activeTab === 'board'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border bg-card hover:bg-muted text-foreground',
                )}
              >
                <Kanban className="h-3.5 w-3.5" />
                <span>Kanban Board</span>
              </button>
            </div>
          </div>

          {/* Tab Views */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ActiveSprintCard projectId={projectId} onOpen={() => setActiveTab('board')} />

                <HealthStatusCard projectId={projectId} onOpenIssue={handleSelectIssue} />

                <NextReleaseCard projectId={projectId} onOpen={() => setActiveTab('releases')} />
              </div>

              {/* Recent Issues Preview */}
              <div className="rounded-lg border border-border bg-card shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">Issue Tracking & Backlog</h3>
                    <p className="text-xs text-muted-foreground">
                      Manage tasks, bugs, stories, and epics with sequential keys (PAY-1, PAY-2...)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('issues')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <span>Open Full Issues Table</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="pt-2">
                  <IssuesView
                    projectId={projectId}
                    onSelectIssue={handleSelectIssue}
                    onOpenCreateModal={() => handleOpenCreateModal()}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'issues' && (
            <div className="space-y-4">
              <div className="border-b border-border pb-2">
                <h3 className="text-lg font-bold">All Issues & Backlog</h3>
                <p className="text-xs text-muted-foreground">
                  View, filter, sort, and customize columns across all project issues. Click any row to slide open the detail drawer.
                </p>
              </div>
              <IssuesView
                projectId={projectId}
                onSelectIssue={handleSelectIssue}
                onOpenCreateModal={() => handleOpenCreateModal()}
              />
            </div>
          )}

          {activeTab === 'board' && (
            <div className="space-y-4">
              <div className="border-b border-border pb-2">
                <h3 className="text-lg font-bold">Active Kanban Board</h3>
                <p className="text-xs text-muted-foreground">
                  Real-time collaborative drag-and-drop workflow with instant optimistic updates and WebSockets synchronization.
                </p>
              </div>
              <KanbanBoard
                projectId={projectId}
                onSelectIssue={handleSelectIssue}
                onOpenCreateModal={(status, sprintId) => handleOpenCreateModal(status, sprintId)}
                onOpenBacklog={() => setActiveTab('sprints')}
              />
            </div>
          )}

          {activeTab === 'sprints' && (
            <div className="space-y-4">
              <div className="border-b border-border pb-2">
                <h3 className="text-lg font-bold">Backlog & Sprints</h3>
                <p className="text-xs text-muted-foreground">
                  Groom the backlog, drag issues into sprints, and track capacity. Let AI propose a sprint sized to your velocity.
                </p>
              </div>
              <BacklogView projectId={projectId} onSelectIssue={handleSelectIssue} />
            </div>
          )}

          {activeTab === 'releases' && (
            <div className="space-y-4">
              <div className="border-b border-border pb-2">
                <h3 className="text-lg font-bold">Releases & Milestones</h3>
                <p className="text-xs text-muted-foreground">
                  Track milestone slip risk, check release readiness, apply AI-suggested fixes after reviewing the diff, and generate release notes.
                </p>
              </div>
              <ReleasesView projectId={projectId} onSelectIssue={handleSelectIssue} />
            </div>
          )}

          {activeTab === 'automations' && (
            <div className="space-y-4">
              <div className="border-b border-border pb-2">
                <h3 className="text-lg font-bold">Automations</h3>
                <p className="text-xs text-muted-foreground">
                  When an issue is created or on a schedule, check conditions, then notify the right people. Every run is logged.
                </p>
              </div>
              <AutomationsView projectId={projectId} />
            </div>
          )}
        </div>
      </main>

      {/* AI Copilot Side Drawer (occupies 45% of workspace width, pushes main to 55%) */}
      {isCopilotOpen && (
        <aside
          className={cn(
            'border-l border-border bg-card flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out shrink-0 animate-slide-in-right z-20',
            'w-full lg:w-[45%] min-w-[380px]',
          )}
        >
          <AiCopilotSideDrawer
            projectId={projectId}
            onClose={() => setIsCopilotOpen(false)}
            onOpenIssueInDrawer={(issueKey) => handleSelectIssue(issueKey)}
          />
        </aside>
      )}
    </div>

    {/* Universal Slide-Over Drawer (z-50) */}
    <IssueDrawer
      issueIdentifier={selectedIssueKey}
      onClose={handleCloseDrawer}
      onSelectIssue={handleSelectIssue}
    />

    {/* Global AI Command Bar (Cmd/Ctrl+K) */}
    <CommandBar
      projectId={projectId}
      projectKey="PAY"
      open={isCommandOpen}
      onOpenChange={setIsCommandOpen}
      onNavigate={setActiveTab}
      onSelectIssue={handleSelectIssue}
      onCreateIssue={() => handleOpenCreateModal()}
      onOpenCopilot={() => setIsCopilotOpen(true)}
    />

    {/* Hybrid Issue Search ("/" shortcut) */}
    <SearchModal
      projectId={projectId}
      isOpen={isSearchOpen}
      onOpenChange={setIsSearchOpen}
      onSelectIssue={handleSelectIssue}
    />

    {/* Universal Create Issue Modal */}
    <CreateIssueModal
      projectId={projectId}
      projectName="Payment Integration Platform"
      projectKey="PAY"
      isOpen={isCreateModalOpen}
      defaultStatus={defaultCreateStatus}
      sprintId={createSprintId}
      onClose={() => setIsCreateModalOpen(false)}
      onCreated={(key) => handleSelectIssue(key)}
    />

    {/* Floating Trigger Pill when side drawer is closed */}
    {!isCopilotOpen && (
      <button
        type="button"
        onClick={() => setIsCopilotOpen(true)}
        className="fixed bottom-6 right-6 z-40 group flex items-center gap-2.5 px-4 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm shadow-2xl hover:shadow-primary/30 hover:scale-105 transition-all duration-200"
      >
        <div className="relative">
          <Sparkles className="h-5 w-5 animate-pulse" />
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400" />
        </div>
        <span>Ask AI Copilot</span>
      </button>
    )}
  </div>
);
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">Loading workspace...</div>}>
      <HomePageContent />
    </Suspense>
  );
}
