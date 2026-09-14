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
