# ProjectFlow — Project Execution Plan & Status Tracker

> **Document Status**: Active  
> **Last Updated**: 2026-09-14  
> **Current Phase**: Phase 1 — Foundation, Workspace Identity & Monorepo Setup (Ready to start)  
> **Related Architecture Plan**: [Architecture_Plan.md](file:///C:/Projects/ProjectFlow/Architecture_Plan.md)

---

## 1. Executive Status Dashboard

| Phase | Description | Status | Core Flow | AI Capability | Completion |
|---|---|:---:|---|---|:---:|
| **Phase 1** | Foundation, Workspace Identity & Monorepo Setup | `IN PROGRESS` | Monorepo, PostgreSQL, Auth, Orgs/Teams/Projects | Foundation Setup | 50% |
| **Phase 2** | Core Issue Tracking & AI-Assisted Issue Creation | `NOT STARTED` | Issue Model, List/Table View, Drawer | Natural Language Issue Creation, Generative Cards | 0% |
| **Phase 3** | Interactive Kanban, Real-Time Sync & In-Drawer AI | `NOT STARTED` | Kanban Board (`@dnd-kit`), WebSockets, Comments | Contextual Issue Copilot, Summaries, Subtasks | 0% |
| **Phase 4** | Vector Embeddings, Semantic Search & Duplicates | `NOT STARTED` | `pgvector`, BullMQ Embedding Pipeline | Hybrid Semantic Search, Duplicate Detection | 0% |
| **Phase 5** | Agile Sprints, Backlog Grooming & Sprint Copilot | `NOT STARTED` | Sprint Lifecycle, Backlog Grooming, Rollovers | AI Sprint Planning, Generative SprintPlan UI | 0% |
| **Phase 6** | Milestones, Releases & AI Release Readiness | `NOT STARTED` | Milestones, Releases, Issue Dependencies | AI Release Readiness, Auto Release Notes, Diff UI | 0% |
| **Phase 7** | Health Engine & Global AI Command Bar | `NOT STARTED` | Deterministic Risk Engine, Notifications | Global `Cmd+K` Command Bar, Health Dashboards | 0% |
| **Phase 8** | Automation Engine & Scheduled Workflows | `NOT STARTED` | Event Trigger-Condition-Action, Cron Jobs | NL Automation Builder, AI Condition Hooks | 0% |
| **Phase 9** | Reporting, Analytics & Production Hardening | `NOT STARTED` | Aggregate Metrics, Security, Audit Trail | AI Executive Digests, AI Cost/Token Controls | 0% |

---

## 2. Detailed Phase Breakdown & Task Checklists

### Phase 1: Foundation, Workspace Identity & Monorepo Setup
- [x] **Monorepo Setup**:
  - [x] Initialize Turborepo + pnpm workspace (`apps/web`, `apps/api`, `apps/ai`, `packages/*`).
  - [x] Configure shared TypeScript configs, ESLint, and Prettier.
  - [x] Configure shared UI, types, and config packages.
- [x] **Database & Multi-Tenancy**:
  - [x] Setup PostgreSQL with Drizzle ORM in `packages/database` (configured for Supabase).
  - [x] Define schemas: `organizations`, `users`, `teams`, `team_members`, `roles`, `permissions`, `user_roles`.
  - [ ] Implement database migrations & seeds targeting Cloud-Hosted Supabase.
- [ ] **Authentication & Security**:
  - [ ] Configure Supabase Auth (GoTrue) with OIDC / Google / Microsoft Entra.
  - [ ] Implement NestJS JWT verification strategy and RBAC guards.
- [ ] **Project Management Core**:
  - [x] Define schemas: `projects`, `project_members`, `project_settings`.
  - [ ] Implement project CRUD REST endpoints in NestJS.
- [x] **Frontend Application Shell**:
  - [x] Setup Next.js App Router with Tailwind CSS, shadcn/ui, and Radix UI.
  - [x] Build layout shell: Sidebar navigation, project/org switcher, breadcrumbs, theme toggle.

---

### Phase 2: Core Issue Tracking & AI-Assisted Issue Creation
- [ ] **Issue Domain Model**:
  - [ ] Define `issues` schema (Types: Task, Bug, Story, Epic, Subtask; Priorities: P0–P4; custom statuses, estimates, due dates).
  - [ ] Issue CRUD REST APIs with input validation (Zod / Class-Validator) and transaction boundaries.
- [ ] **Frontend Views**:
  - [ ] Build high-performance List/Table view with TanStack Table (sorting, filtering, pagination).
  - [ ] Build Universal Issue Drawer component (accessible across all screens without page reloads).
- [ ] **AI-First Foundation & NL Issue Creation**:
  - [ ] Setup AI Tool Gateway in NestJS with strict input validation and authorization checks.
  - [ ] Integrate CopilotKit into Next.js frontend.
  - [ ] Implement `create_issue` AI tool with intent extraction from free text.
  - [ ] Build generative `IssueCard` preview component for 1-click review and creation.

---

### Phase 3: Interactive Kanban, Real-Time Collaboration & In-Drawer AI Copilot
- [ ] **Interactive Kanban**:
  - [ ] Build drag-and-drop Kanban board using `@dnd-kit`.
  - [ ] Optimistic UI updates with TanStack Query.
- [ ] **Collaboration & Attachments**:
  - [ ] Issue comments schema (`issue_comments`) with rich Markdown support.
  - [ ] Issue attachments with AWS S3 pre-signed upload URLs (`issue_attachments`).
  - [ ] Issue activity history tracking (`issue_activity`).
- [ ] **Real-Time Layer**:
  - [ ] Setup NestJS WebSockets gateway backed by Redis adapter.
  - [ ] Broadcast live card status updates, new comments, and active user presence.
- [ ] **In-Drawer Contextual AI Copilot**:
  - [ ] Embed "Ask AI" copilot directly within the Universal Issue Drawer.
  - [ ] Thread summarization tool for long comment histories.
  - [ ] Smart subtask generator tool (parses description into subtasks).
  - [ ] Assignee & priority suggestion tool based on issue content and team workload.

---

### Phase 4: Vector Embeddings, Semantic Search & Duplicate Detection
- [ ] **Vector Infrastructure**:
  - [ ] Enable and configure `pgvector` extension in PostgreSQL.
  - [ ] Setup Redis + BullMQ asynchronous embedding generation queue.
  - [ ] Setup domain event listeners to enqueue embedding jobs on issue/comment mutations.
- [ ] **Semantic Search**:
  - [ ] Implement hybrid search combining PostgreSQL Full-Text Search (tsvector) and vector similarity.
  - [ ] Build search UI modal with instant results and keyboard navigation.
- [ ] **Similar Issue & Duplicate Bug Detection**:
  - [ ] Background vector similarity check triggered on issue creation draft.
  - [ ] Warning UI with similarity score match (e.g., *"Possible duplicate of BUG-1042 (93% match)"*).

---

### Phase 5: Agile Sprints, Backlog Grooming & AI Sprint Copilot
- [ ] **Sprint Management**:
  - [ ] Schema: `sprints`, `sprint_issues` (Statuses: `PLANNED`, `ACTIVE`, `COMPLETED`).
  - [ ] Sprint lifecycle endpoints (start sprint, complete sprint, rollover unresolved issues).
- [ ] **Backlog & Sprint Views**:
  - [ ] Dedicated Backlog Grooming view with drag-and-drop sprint assignment.
  - [ ] Active Sprint Board view with real-time progress indicators.
- [ ] **AI Sprint Planning Copilot**:
  - [ ] Sprint Agent toolset (`get_team_capacity`, `get_velocity`, `suggest_sprint_scope`).
  - [ ] Generative `SprintPlan` preview component displaying proposed scope vs capacity.
  - [ ] Natural language commands (e.g., *"Prepare Sprint 44 with top backlog items"*).

---

### Phase 6: Milestones, Releases & AI Release Readiness
- [ ] **Milestones & Releases**:
  - [ ] Schema: `milestones`, `milestone_issues`, `releases`, `release_issues`.
  - [ ] Issue dependency graph tracking: `Blocks`, `Blocked By`, `Relates To`, `Depends On`.
  - [ ] Milestone progress bars and target date slip alerts.
- [ ] **AI Release Readiness Evaluator**:
  - [ ] Deterministic checks for unresolved P0/P1 bugs, blocked issues, and unverified criteria.
  - [ ] AI narrative risk evaluation for target release dates.
- [ ] **Automated AI Release Notes Generator**:
  - [ ] Auto-compile completed issues into categorised Markdown changelogs.
- [ ] **Human-in-the-Loop Diff & Bulk Action UI**:
  - [ ] Visual diff preview for multi-issue batch modifications before execution.

---

### Phase 7: Deterministic Project Health Engine & Global AI Command Bar
- [ ] **Project Health Engine**:
  - [ ] Deterministic health calculation service (cycle times, bug aging, blocked dependencies).
  - [ ] Health status tags: `HEALTHY`, `AT_RISK`, `CRITICAL`.
- [ ] **Notification Engine**:
  - [ ] In-app notification center with read/unread tracking.
  - [ ] Email notifications via BullMQ worker.
  - [ ] Web push notifications.
  - [ ] User notification preference controls.
- [ ] **Global AI Command Bar (`Cmd+K`)**:
  - [ ] Omnipresent AI bar accessible from any page.
  - [ ] Cross-project natural language query routing.
  - [ ] Generative `RiskReport` and `ProjectHealthCard` UI widgets.

---

### Phase 8: Automation Engine & Scheduled Background Workflows
- [ ] **Automation Engine**:
  - [ ] Schema: `automations`, `automation_rules`, `automation_runs`.
  - [ ] Internal event-driven Trigger-Condition-Action execution pipeline.
  - [ ] Project-level Visual Automation Builder UI.
- [ ] **Scheduled Automations**:
  - [ ] BullMQ recurring cron jobs (daily overdue issue sweeps, weekly digests).
- [ ] **AI-Assisted Automations**:
  - [ ] Natural language automation rule generator (compiles English prompts into rule JSON).
  - [ ] AI condition hooks (triggering on semantic classification or sentiment).

---

### Phase 9: Reporting, Analytics & Production Hardening
- [ ] **Data Analytics**:
  - [ ] Materialized aggregate metrics tables (`project_daily_metrics`, `sprint_metrics`).
  - [ ] Interactive charts: Burndown, cumulative flow, cycle & lead time, throughput.
- [ ] **AI-Generated Reports**:
  - [ ] Automated and on-demand executive digests (daily/weekly project summaries).
- [ ] **Security, Auditing & Hardening**:
  - [ ] Comprehensive `audit_logs` and dedicated `ai_audit_trail`.
  - [ ] API rate limiting & AI token/cost controls.
  - [ ] Prompt injection sanitization layer.
  - [ ] Docker containerization and GitHub Actions CI/CD pipelines.

---

## 3. Architecture Modification & Decision Log (ADR)

| ID | Date | Area | Decision / Change | Rationale |
|---|:---:|---|---|---|
| **ADR-001** | 2026-09-14 | Scope / Integrations | Removed Slack & Microsoft Teams integrations | Focus strictly on native In-App, Email, and Web Push notifications to minimize external API dependencies. |
| **ADR-002** | 2026-09-14 | Scope / Migration | Removed Jira Importer | Workspace operates natively as a clean, modern platform; eliminates brittle XML/JSON parsing pipelines. |
| **ADR-003** | 2026-09-14 | Infrastructure / Jobs | Removed Temporal workflow engine | Redis + BullMQ natively handles background queues, async tasks, and scheduled cron jobs without cluster overhead. |
| **ADR-004** | 2026-09-14 | AI Architecture | Deferred Multi-Agent Orchestration & Predictive Capacity Forecasting | Use a single modular agent runtime with typed domain tools and deterministic health calculations for initial phases. |
| **ADR-005** | 2026-09-14 | Roadmap Strategy | Restructured delivery into 9 cohesive phases with early AI integration | Pairs basic core flows with AI capabilities starting in Phase 2 & 3 instead of postponing AI to the end. |
| **ADR-006** | 2026-09-14 | Database, Auth & Storage | Adopted Cloud-Hosted Supabase | Uses managed Supabase (PostgreSQL 16, pgvector, Supabase Auth with OIDC, and S3-compatible Storage). Retains Drizzle ORM schemas and NestJS domain layer while eliminating database DevOps. |

---

## 4. Detours, Blockers & Pivots Log

> Use this section to record any unexpected technical challenges, architectural pivots, scope adjustments, or blockers encountered during development.

| Date | Phase | Description of Detour / Blocker | Reason / Root Cause | Resolution / Path Forward | Status |
|:---:|:---:|---|---|---|:---:|
| *Pending* | - | *No detours recorded yet.* | - | - | - |

---

## 5. Future Implementations (Deferred Beyond Phase 9)

1. **Multi-Agent Orchestration**:
   - Autonomous multi-agent coordination swarms (e.g., specialized QA agent negotiating with an autonomous sprint planning agent).
2. **Predictive Capacity Forecasting**:
   - Machine learning models forecasting team velocity trends, Monte Carlo delivery simulations, and multi-quarter resource planning.
3. **External Client / Guest Portals**:
   - Public-facing read-only status pages and restricted guest-collaborator roles.

---

## 6. Tracker Maintenance Guidelines

- **Active Updates**: Whenever a phase or milestone begins, mark its status as `IN PROGRESS`. Once verified and tested, mark as `COMPLETED`.
- **Detour Protocol**: If an unexpected problem requires deviating from the architecture plan or changing dependencies, document it immediately in **Section 4 (Detours, Blockers & Pivots Log)**.
- **Architectural Changes**: Any modifications to the database schema, technology stack, or API design must be logged under **Section 3 (ADR)** and synchronized with [ai_first_project_management_architecture_plan.md](file:///C:/Projects/ProjectFlow/ai_first_project_management_architecture_plan.md).
