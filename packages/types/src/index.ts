// ==========================================
// Organization, User & RBAC Types
// ==========================================

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  key: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

export type ProjectRole = 'LEAD' | 'MAINTAINER' | 'CONTRIBUTOR' | 'VIEWER';

// ==========================================
// Project Domain Types
// ==========================================

export interface Project {
  id: string;
  organizationId: string;
  teamId?: string | null;
  key: string; // e.g. "PROJ", "PAY"
  name: string;
  description?: string | null;
  leadId: string;
  healthStatus: ProjectHealthStatus;
  issueCounter: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectHealthStatus = 'HEALTHY' | 'AT_RISK' | 'CRITICAL';

export interface ProjectMember {
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: Date;
}

// ==========================================
// Issue Domain Types (Phase 2 preview)
// ==========================================

export type IssueType = 'TASK' | 'BUG' | 'STORY' | 'EPIC' | 'SUBTASK';

export type IssuePriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export type StandardIssueStatus =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'BLOCKED'
  | 'DONE'
  | 'CANCELLED';

export interface Issue {
  id: string;
  projectId: string;
  issueKey: string; // e.g. "PAY-104"
  keyNumber: number;
  title: string;
  description?: string | null;
  type: IssueType;
  status: string;
  priority: IssuePriority;
  assigneeId?: string | null;
  reporterId: string;
  parentIssueId?: string | null;
  sprintId?: string | null;
  milestoneId?: string | null;
  releaseId?: string | null;
  storyPoints?: number | null;
  estimateHours?: number | null;
  dueDate?: Date | null;
  isArchived: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
}

// ==========================================
// Sprints, Milestones & Releases
// ==========================================

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  status: SprintStatus;
  capacityPoints?: number | null;
  startedAt?: Date | null;
  committedPoints?: number | null;
  committedIssueCount?: number | null;
  completedAt?: Date | null;
  completedPoints?: number | null;
  completedIssueCount?: number | null;
  carriedOverIssueCount?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  targetDate?: Date | null;
  completionPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ReleaseStatus = 'PLANNED' | 'IN_PROGRESS' | 'READY_FOR_RELEASE' | 'RELEASED';

export interface Release {
  id: string;
  projectId: string;
  version: string;
  name: string;
  description?: string | null;
  targetDate?: Date | null;
  status: ReleaseStatus;
  releaseNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// API & Common Types
// ==========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==========================================
// AI Copilot & Generative UI Types
// ==========================================

export interface CopilotIssueItem {
  id: string;
  issueKey: string;
  title: string;
  type: IssueType;
  priority: IssuePriority;
  status: string;
  assignee?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
  estimateHours?: number | null;
  storyPoints?: number | null;
}

export interface CopilotIssueListWidget {
  type: 'issue_list';
  title: string;
  filterApplied?: string;
  totalCount: number;
  issues: CopilotIssueItem[];
}

export interface CopilotMetricsWidget {
  type: 'metrics';
  title: string;
  totalIssues: number;
  completedIssues: number;
  pendingIssues: number;
  completionRate: number;
  bugCount: number;
  bugRate: number;
  statusBreakdown: {
    backlog: number;
    todo: number;
    inProgress: number;
    inReview: number;
    done: number;
  };
  priorityBreakdown: {
    p0: number;
    p1: number;
    p2: number;
    p3: number;
    p4: number;
  };
  healthStatus: 'HEALTHY' | 'AT_RISK' | 'CRITICAL' | 'ON_TRACK';
  healthSummary: string;
}

export type CopilotWidget = CopilotIssueListWidget | CopilotMetricsWidget;

export interface ParsedIssueDraft {
  title: string;
  type: IssueType;
  priority: IssuePriority;
  status: string;
  estimateHours?: number | null;
  storyPoints?: number | null;
  description: string;
  suggestedDueDate?: string | null;
  explanation: string;
  modelUsed: string;
}

export interface CopilotStatCard {
  label: string;
  value: string | number;
  variant?: 'default' | 'healthy' | 'warning' | 'critical' | 'primary';
  subtext?: string;
  icon?: 'check' | 'bug' | 'clock' | 'trending' | 'alert' | 'user' | 'target' | 'activity';
}

export interface CopilotStatGridBlock {
  type: 'stat_grid';
  title?: string;
  stats: CopilotStatCard[];
}

export interface CopilotChartDataPoint {
  label: string;
  value: number;
  color?: string;
  secondaryValue?: number;
}

export interface CopilotChartBlock {
  type: 'chart';
  chartType: 'pie' | 'bar' | 'line';
  title: string;
  subtitle?: string;
  data: CopilotChartDataPoint[];
  total?: number;
  unit?: string;
}

export interface CopilotTableBlock {
  type: 'table';
  title: string;
  totalCount?: number;
  issues: CopilotIssueItem[];
}

export interface CopilotProfileCardBlock {
  type: 'profile_card';
  title: string;
  subtitle?: string;
  avatarText?: string;
  avatarUrl?: string | null;
  badgeText?: string;
}

export interface CopilotProposalBlock {
  type: 'proposal_card';
  draft: ParsedIssueDraft;
}

export type GenerativeBlock =
  | CopilotStatGridBlock
  | CopilotChartBlock
  | CopilotTableBlock
  | CopilotProfileCardBlock
  | CopilotProposalBlock
  | CopilotSprintPlanBlock
  | CopilotIssueListWidget
  | CopilotMetricsWidget;

export interface CopilotChatResponse {
  intent: 'chat' | 'create_issue' | 'plan_sprint';
  reply: string;
  blocks?: GenerativeBlock[];
  widget?: CopilotWidget;
  draft?: ParsedIssueDraft;
  modelUsed: string;
}



// ==========================================
// Search & Duplicate Detection (Phase 4)
// ==========================================

/** Which retriever surfaced a result: exact key lookup, full-text, or vector similarity. */
export type SearchMatchSource = 'KEY' | 'KEYWORD' | 'SEMANTIC';

export interface IssueSearchResult {
  id: string;
  issueKey: string;
  title: string;
  type: IssueType;
  status: string;
  priority: IssuePriority;
  assignee: { id: string; name: string; avatarUrl?: string | null } | null;
  /** Reciprocal Rank Fusion score; only meaningful relative to other results in the same response. */
  score: number;
  matchSources: SearchMatchSource[];
  /** Best cosine similarity (0–1) when matched semantically, otherwise null. */
  similarity: number | null;
  /** Present when the strongest evidence for this issue came from one of its comments. */
  matchedComment: { id: string; snippet: string } | null;
}

export interface IssueSearchResponse {
  query: string;
  results: IssueSearchResult[];
  /** False when semantic retrieval was skipped or unavailable (keyword results only). */
  semanticEnabled: boolean;
}

export interface SimilarIssue {
  id: string;
  issueKey: string;
  title: string;
  type: IssueType;
  status: string;
  priority: IssuePriority;
  /** Cosine similarity (0–1). */
  similarity: number;
}

export interface SimilarIssuesResponse {
  matches: SimilarIssue[];
  semanticEnabled: boolean;
}

// ==========================================
// Sprints, Velocity & AI Sprint Planning (Phase 5)
// ==========================================

/** Live tallies over the issues currently in a sprint. */
export interface SprintProgress {
  issueCount: number;
  doneIssueCount: number;
  totalPoints: number;
  donePoints: number;
  unestimatedCount: number;
  blockedCount: number;
}

/** Sprint as returned by the API (dates are ISO strings). */
export interface SprintSummary {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  capacityPoints: number | null;
  startDate: string | null;
  endDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  committedPoints: number | null;
  committedIssueCount: number | null;
  completedPoints: number | null;
  completedIssueCount: number | null;
  carriedOverIssueCount: number | null;
  progress: SprintProgress;
  createdAt: string;
  updatedAt: string;
}

export interface SprintVelocityEntry {
  sprintId: string;
  name: string;
  committedPoints: number;
  completedPoints: number;
  completedAt: string;
}

export interface SprintVelocity {
  /** Most recent completed sprints, newest first. */
  recent: SprintVelocityEntry[];
  /** Mean completed points of `recent`, or null without history. */
  averageVelocity: number | null;
}

export type SprintRolloverTarget = { type: 'BACKLOG' } | { type: 'SPRINT'; sprintId: string };

export interface SprintCompletionResult {
  sprint: SprintSummary;
  carriedOverCount: number;
  carriedOverTo: { type: 'BACKLOG' } | { type: 'SPRINT'; sprintId: string; sprintName: string };
}

export interface SprintPlanIssue {
  id: string;
  issueKey: string;
  title: string;
  type: IssueType;
  priority: IssuePriority;
  status: string;
  storyPoints: number | null;
  /** Points counted toward capacity; equals storyPoints unless the estimate was assumed. */
  plannedPoints: number;
  estimateAssumed: boolean;
  reason: string;
}

export interface SprintPlanWarning {
  level: 'info' | 'warning' | 'critical';
  message: string;
  issueKeys?: string[];
}

export type SprintCapacitySource = 'REQUEST' | 'SPRINT' | 'VELOCITY' | 'DEFAULT';

/** AI-assisted proposal; nothing is persisted until the user applies it. */
export interface SprintPlanProposal {
  projectId: string;
  /** Existing PLANNED sprint to fill, or null to create a new sprint on apply. */
  targetSprintId: string | null;
  sprintName: string;
  goal: string;
  capacityPoints: number;
  capacitySource: SprintCapacitySource;
  averageVelocity: number | null;
  proposedPoints: number;
  /** Issues already in the target sprint (kept as-is). */
  existingIssues: SprintPlanIssue[];
  /** Newly proposed issues, in ranked order. */
  issues: SprintPlanIssue[];
  /** Ranked candidates that did not fit, offered for manual swaps during review. */
  alternates: SprintPlanIssue[];
  warnings: SprintPlanWarning[];
  rationale: string;
  suggestedStartDate: string;
  suggestedEndDate: string;
  modelUsed: string;
}

export interface CopilotSprintPlanBlock {
  type: 'sprint_plan';
  plan: SprintPlanProposal;
}
