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

export interface CopilotChatResponse {
  intent: 'chat' | 'create_issue';
  reply: string;
  widget?: CopilotWidget;
  draft?: ParsedIssueDraft;
  modelUsed: string;
}


