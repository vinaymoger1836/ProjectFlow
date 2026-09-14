'use client';

import React, { useState, useEffect, Suspense } from 'react';
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
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { IssuesView } from '@/components/issues/issues-view';
import { cn } from '@/lib/utils';

type NavTab = 'overview' | 'issues' | 'board' | 'sprints';

function HomePageContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<NavTab>('overview');

  // Auto-switch to issues tab if URL contains ?issue=KEY
  useEffect(() => {
    if (searchParams.get('issue')) {
      setActiveTab('issues');
    }
  }, [searchParams]);

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
              <span>Sprints & Releases</span>
            </button>

            <div className="pt-4 text-xs font-semibold text-muted-foreground px-3 py-2 uppercase tracking-wider">
              AI Workflows
            </div>

            <button
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground font-medium text-sm transition-colors text-left"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span>AI Command Bar</span>
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

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border px-6 flex items-center justify-between bg-card/60 backdrop-blur-md shrink-0">
          {/* AI Command Bar Search Trigger */}
          <div className="flex items-center gap-2 w-96">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs bg-muted/40 border border-input rounded-md text-muted-foreground hover:border-primary transition-colors shadow-xs"
            >
              <span className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5" />
                <span>Ask AI or search issues (Cmd+K)...</span>
              </span>
              <kbd className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border font-mono">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground relative"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            </button>
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

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setActiveTab('issues')}
                className={cn(
                  'px-3.5 py-1.5 text-xs font-medium rounded-md border transition-colors',
                  activeTab === 'issues'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card hover:bg-muted text-foreground',
                )}
              >
                View Issues Table
              </button>
            </div>
          </div>

          {/* Tab Views */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-lg border border-border bg-card shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Active Sprint 42</span>
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-2xl font-bold">18 / 26 Pts</div>
                  <p className="text-xs text-muted-foreground">4 days remaining • 69% completed</p>
                </div>

                <div className="p-5 rounded-lg border border-border bg-card shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Health Status</span>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold text-amber-500">HEALTHY</div>
                  <p className="text-xs text-muted-foreground">0 critical blockers • 1 P1 bug</p>
                </div>

                <div className="p-5 rounded-lg border border-border bg-card shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Target Release v2.4</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold">Oct 12, 2026</div>
                  <p className="text-xs text-muted-foreground">2 milestones active • 84% readiness</p>
                </div>
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
                  <IssuesView />
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
              <IssuesView />
            </div>
          )}

          {activeTab === 'board' && (
            <div className="p-12 text-center rounded-lg border border-dashed border-border bg-card/40 space-y-3">
              <Kanban className="h-8 w-8 text-muted-foreground mx-auto" />
              <h3 className="font-semibold text-base">Interactive Kanban Board (Phase 3)</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Drag-and-drop Kanban board powered by @dnd-kit and real-time WebSockets synchronization is planned for Phase 3.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('issues')}
                className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground"
              >
                Switch to Issues Table
              </button>
            </div>
          )}

          {activeTab === 'sprints' && (
            <div className="p-12 text-center rounded-lg border border-dashed border-border bg-card/40 space-y-3">
              <Calendar className="h-8 w-8 text-muted-foreground mx-auto" />
              <h3 className="font-semibold text-base">Agile Sprints & Releases (Phases 5 & 6)</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Sprint planning, capacity forecasting, and automated release readiness are scheduled for Phases 5 and 6.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('issues')}
                className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground"
              >
                View Current Issues
              </button>
            </div>
          )}
        </div>
      </main>
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
