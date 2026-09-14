'use client';

import React from 'react';
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
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col justify-between">
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
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-2 rounded-md bg-secondary text-secondary-foreground font-medium text-sm transition-colors"
            >
              <LayoutDashboard className="h-4 w-4 text-primary" />
              Overview
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground font-medium text-sm transition-colors"
            >
              <Kanban className="h-4 w-4" />
              Active Board
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground font-medium text-sm transition-colors"
            >
              <ListTodo className="h-4 w-4" />
              Issues & Backlog
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground font-medium text-sm transition-colors"
            >
              <Calendar className="h-4 w-4" />
              Sprints & Milestones
            </a>

            <div className="pt-4 text-xs font-semibold text-muted-foreground px-3 py-2 uppercase tracking-wider">
              AI Copilots
            </div>
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground font-medium text-sm transition-colors"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              AI Command Bar
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground font-medium text-sm transition-colors"
            >
              <Layers className="h-4 w-4" />
              Project Health Insights
            </a>
          </nav>
        </div>

        {/* Bottom Settings */}
        <div className="p-4 border-t border-border">
          <a
            href="#"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground font-medium text-sm transition-colors"
          >
            <Settings className="h-4 w-4" />
            Project Settings
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border px-6 flex items-center justify-between bg-card/50 backdrop-blur-sm">
          {/* AI Command Bar Search Trigger */}
          <div className="flex items-center gap-2 w-96">
            <button className="w-full flex items-center justify-between px-3 py-1.5 text-sm bg-muted/50 border border-input rounded-md text-muted-foreground hover:border-primary transition-colors">
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <span>Ask AI or search (Cmd+K)...</span>
              </span>
              <kbd className="text-xs bg-background px-1.5 py-0.5 rounded border border-border">⌘K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            </button>
            <div className="h-8 w-8 rounded-full bg-primary/20 text-primary font-semibold flex items-center justify-center text-sm border border-primary/30">
              U
            </div>
          </div>
        </header>

        {/* Workspace Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Payment Integration Platform</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Unified checkout and global payment gateway migration (Key: <span className="font-mono text-primary font-medium">PAY</span>)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-3.5 py-2 text-sm font-medium rounded-md border border-input bg-card hover:bg-muted transition-colors">
                View Sprints
              </button>
              <button className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors">
                <Sparkles className="h-4 w-4" />
                New Issue with AI
              </button>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-lg border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Active Sprint 42</span>
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold mt-2">18 / 26 Pts</div>
              <p className="text-xs text-muted-foreground mt-1">4 days remaining • 69% completed</p>
            </div>

            <div className="p-5 rounded-lg border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Health Status</span>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold mt-2 text-amber-500">HEALTHY</div>
              <p className="text-xs text-muted-foreground mt-1">0 critical blockers • 1 P1 bug unresolved</p>
            </div>

            <div className="p-5 rounded-lg border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Release v2.4 Target</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold mt-2">Oct 12, 2026</div>
              <p className="text-xs text-muted-foreground mt-1">2 milestones active • 84% readiness</p>
            </div>
          </div>

          {/* Monorepo Architecture Status Notice */}
          <div className="p-6 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <Sparkles className="h-5 w-5" />
              <span>Phase 1 Scaffolding Live</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Turborepo workspace initialized with Next.js web application, NestJS API service, Drizzle ORM PostgreSQL schema with pgvector support, and shared packages.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
