import {
  Issue,
  IssuePriority,
  IssueType,
  CopilotChatResponse,
  CopilotWidget,
  CopilotIssueListWidget,
  CopilotMetricsWidget,
  CopilotIssueItem,
  ParsedIssueDraft,
  GenerativeBlock,
  CopilotStatCard,
  CopilotStatGridBlock,
  CopilotChartDataPoint,
  CopilotChartBlock,
  CopilotTableBlock,
  CopilotProfileCardBlock,
  IssueSearchResponse,
  IssueSearchResult,
  SimilarIssue,
  SimilarIssuesResponse,
  SprintSummary,
  SprintStatus,
  SprintVelocity,
  SprintCompletionResult,
  SprintPlanProposal,
  SprintPlanIssue,
  SprintPlanWarning,
  CopilotSprintPlanBlock,
  MilestoneSummary,
  MilestoneHealth,
  ReleaseSummary,
  ReleaseStatus,
  ReleaseReadinessReport,
  ReadinessCheck,
  ReadinessSuggestion,
  ReleaseShipResult,
  ReleaseNotesDraft,
  IssueDependencyLink,
  IssueLinkKind,
  BulkIssueOperation,
  BulkIssueChanges,
  BulkChangeField,
  BulkChangePreview,
  BulkChangeSource,
  WorkProgress,
} from '@projectflow/types';

export type {
  MilestoneSummary,
  MilestoneHealth,
  ReleaseSummary,
  ReleaseStatus,
  ReleaseReadinessReport,
  ReadinessCheck,
  ReadinessSuggestion,
  ReleaseShipResult,
  ReleaseNotesDraft,
  IssueDependencyLink,
  IssueLinkKind,
  BulkIssueOperation,
  BulkIssueChanges,
  BulkChangeField,
  BulkChangePreview,
  BulkChangeSource,
  WorkProgress,
  SprintSummary,
  SprintStatus,
  SprintVelocity,
  SprintCompletionResult,
  SprintPlanProposal,
  SprintPlanIssue,
  SprintPlanWarning,
  CopilotSprintPlanBlock,
  IssueSearchResponse,
  IssueSearchResult,
  SimilarIssue,
  SimilarIssuesResponse,
  CopilotChatResponse,
  CopilotWidget,
  CopilotIssueListWidget,
  CopilotMetricsWidget,
  CopilotIssueItem,
  ParsedIssueDraft,
  GenerativeBlock,
  CopilotStatCard,
  CopilotStatGridBlock,
  CopilotChartDataPoint,
  CopilotChartBlock,
  CopilotTableBlock,
  CopilotProfileCardBlock,
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface IssueQueryParams {
  projectId?: string;
  type?: IssueType;
  status?: string;
  priority?: IssuePriority;
  assigneeId?: string;
  sprintId?: string;
  milestoneId?: string;
  releaseId?: string;
  search?: string;
  includeArchived?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status' | 'keyNumber';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedIssues {
  items: (Issue & {
    assignee?: { id: string; name: string; email: string; avatarUrl?: string | null } | null;
    reporter: { id: string; name: string; email: string; avatarUrl?: string | null };
    labels: { id: string; name: string; color: string }[];
  })[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IssueCommentItem {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

export interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, any>;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('supabase_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new ApiError(
      json.message || json.error?.message || `HTTP error ${res.status}`,
      res.status,
      typeof json.code === 'string' ? json.code : undefined,
      json,
    );
  }

  return json.data ?? json;
}

/** HTTP error carrying the status, an optional machine-readable code, and the raw body. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** True when a gated release transition was refused because critical readiness checks fail. */
export function isReadinessGateError(err: unknown): err is ApiError & { body: { readiness: ReleaseReadinessReport } } {
  return err instanceof ApiError && err.code === 'READINESS_CHECK_FAILED';
}

export const api = {
  // Issues
  listIssues: async (projectId: string, params: IssueQueryParams = {}): Promise<PaginatedIssues> => {
    const searchParams = new URLSearchParams();
    if (params.type) searchParams.set('type', params.type);
    if (params.status) searchParams.set('status', params.status);
    if (params.priority) searchParams.set('priority', params.priority);
    if (params.assigneeId) searchParams.set('assigneeId', params.assigneeId);
    if (params.sprintId) searchParams.set('sprintId', params.sprintId);
    if (params.milestoneId) searchParams.set('milestoneId', params.milestoneId);
    if (params.releaseId) searchParams.set('releaseId', params.releaseId);
    if (params.search) searchParams.set('search', params.search);
    if (params.includeArchived) searchParams.set('includeArchived', 'true');
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

    const query = searchParams.toString();
    return request<PaginatedIssues>(`/projects/${projectId}/issues${query ? `?${query}` : ''}`);
  },

  getIssue: async (identifier: string) => {
    return request<PaginatedIssues['items'][0] & { commentCount: number }>(`/issues/${identifier}`);
  },

  createIssue: async (projectId: string, payload: any) => {
    return request<PaginatedIssues['items'][0]>(`/projects/${projectId}/issues`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateIssue: async (issueId: string, payload: any) => {
    return request<PaginatedIssues['items'][0]>(`/issues/${issueId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteIssue: async (issueId: string) => {
    return request<{ success: boolean; message: string }>(`/issues/${issueId}`, {
      method: 'DELETE',
    });
  },

  // Project Members
  listProjectMembers: async (projectId: string): Promise<{
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    role: string;
  }[]> => {
    return request(`/projects/${projectId}/members`);
  },

  // Comments
  listComments: async (issueId: string): Promise<IssueCommentItem[]> => {
    return request<IssueCommentItem[]>(`/issues/${issueId}/comments`);
  },

  addComment: async (issueId: string, content: string): Promise<IssueCommentItem> => {
    return request<IssueCommentItem>(`/issues/${issueId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  // Subtasks
  listSubtasks: async (issueId: string) => {
    return request<any[]>(`/issues/${issueId}/subtasks`);
  },

  createSubtask: async (issueId: string, payload: { title: string; priority?: string; estimateHours?: number; assigneeId?: string }) => {
    return request<any>(`/issues/${issueId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // AI Workflows
  chatWithCopilot: async (
    projectId: string,
    prompt: string,
    history?: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<CopilotChatResponse> => {
    return request<CopilotChatResponse>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ projectId, prompt, history }),
    });
  },

  parseIssueWithAi: async (projectId: string, prompt: string): Promise<ParsedIssueDraft> => {
    return request<ParsedIssueDraft>('/ai/parse-issue', {
      method: 'POST',
      body: JSON.stringify({ projectId, prompt }),
    });
  },

  executeAiTool: async (tool: 'create_issue', projectId: string, payload: any) => {
    return request<PaginatedIssues['items'][0]>('/ai/execute-tool', {
      method: 'POST',
      body: JSON.stringify({ tool, projectId, payload }),
    });
  },

  suggestSubtasks: async (issueId: string): Promise<{ subtasks: { title: string; priority: string; estimateHours: number }[]; explanation: string; modelUsed: string }> => {
    return request(`/ai/issues/${issueId}/suggest-subtasks`, {
      method: 'POST',
    });
  },

  summarizeThread: async (issueId: string): Promise<{ summary: string; decisions: string[]; nextSteps: string[]; modelUsed: string }> => {
    return request(`/ai/issues/${issueId}/summarize`, {
      method: 'POST',
    });
  },

  suggestTriage: async (issueId: string): Promise<{
    suggestedPriority: string;
    priorityReason: string;
    suggestedAssigneeId: string | null;
    suggestedAssigneeName: string;
    assigneeReason: string;
    modelUsed: string;
  }> => {
    return request(`/ai/issues/${issueId}/suggest-triage`, {
      method: 'POST',
    });
  },

  /** Pages through the 100-item API limit to return every matching issue. */
  listAllIssues: async (projectId: string, params: IssueQueryParams = {}): Promise<PaginatedIssues['items']> => {
    const items: PaginatedIssues['items'] = [];
    for (let page = 1; ; page++) {
      const res = await api.listIssues(projectId, { ...params, page, limit: 100 });
      items.push(...res.items);
      if (page >= res.totalPages) return items;
    }
  },

  // Sprints
  listSprints: async (projectId: string, status?: SprintStatus[]): Promise<SprintSummary[]> => {
    const query = status && status.length > 0 ? `?status=${status.join(',')}` : '';
    return request<SprintSummary[]>(`/projects/${projectId}/sprints${query}`);
  },

  getSprintVelocity: async (projectId: string): Promise<SprintVelocity> => {
    return request<SprintVelocity>(`/projects/${projectId}/sprints/velocity`);
  },

  createSprint: async (
    projectId: string,
    payload: { name?: string; goal?: string; capacityPoints?: number; startDate?: string; endDate?: string },
  ): Promise<SprintSummary> => {
    return request<SprintSummary>(`/projects/${projectId}/sprints`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateSprint: async (
    sprintId: string,
    payload: {
      name?: string;
      goal?: string | null;
      capacityPoints?: number | null;
      startDate?: string | null;
      endDate?: string | null;
    },
  ): Promise<SprintSummary> => {
    return request<SprintSummary>(`/sprints/${sprintId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteSprint: async (sprintId: string): Promise<{ success: boolean; message: string }> => {
    return request(`/sprints/${sprintId}`, { method: 'DELETE' });
  },

  startSprint: async (sprintId: string, payload: { startDate?: string; endDate?: string }): Promise<SprintSummary> => {
    return request<SprintSummary>(`/sprints/${sprintId}/start`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  completeSprint: async (
    sprintId: string,
    payload: { rolloverTo: 'BACKLOG' | 'SPRINT'; rolloverSprintId?: string },
  ): Promise<SprintCompletionResult> => {
    return request<SprintCompletionResult>(`/sprints/${sprintId}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  planSprint: async (payload: {
    projectId: string;
    sprintId?: string;
    capacityPoints?: number;
    instructions?: string;
  }): Promise<SprintPlanProposal> => {
    return request<SprintPlanProposal>('/ai/sprint-plan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  applySprintPlan: async (payload: {
    projectId: string;
    sprintId?: string;
    name: string;
    goal?: string;
    capacityPoints: number;
    startDate?: string;
    endDate?: string;
    issueIds: string[];
  }): Promise<SprintSummary> => {
    return request<SprintSummary>('/ai/sprint-plan/apply', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Search & Duplicate Detection
  searchIssues: async (
    projectId: string,
    q: string,
    options: { limit?: number; signal?: AbortSignal } = {},
  ): Promise<IssueSearchResponse> => {
    const searchParams = new URLSearchParams({ q });
    if (options.limit) searchParams.set('limit', String(options.limit));
    return request<IssueSearchResponse>(`/projects/${projectId}/search?${searchParams.toString()}`, {
      signal: options.signal,
    });
  },

  findSimilarIssues: async (
    projectId: string,
    payload: { title: string; description?: string; excludeIssueId?: string; limit?: number },
    signal?: AbortSignal,
  ): Promise<SimilarIssuesResponse> => {
    return request<SimilarIssuesResponse>(`/projects/${projectId}/search/similar`, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    });
  },

  // Milestones
  listMilestones: async (projectId: string): Promise<MilestoneSummary[]> => {
    return request<MilestoneSummary[]>(`/projects/${projectId}/milestones`);
  },

  createMilestone: async (
    projectId: string,
    payload: { name: string; description?: string; targetDate?: string },
  ): Promise<MilestoneSummary> => {
    return request<MilestoneSummary>(`/projects/${projectId}/milestones`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateMilestone: async (
    milestoneId: string,
    payload: { name?: string; description?: string | null; targetDate?: string | null },
  ): Promise<MilestoneSummary> => {
    return request<MilestoneSummary>(`/milestones/${milestoneId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteMilestone: async (milestoneId: string): Promise<{ success: boolean; message: string }> => {
    return request(`/milestones/${milestoneId}`, { method: 'DELETE' });
  },

  // Releases
  listReleases: async (projectId: string): Promise<ReleaseSummary[]> => {
    return request<ReleaseSummary[]>(`/projects/${projectId}/releases`);
  },

  createRelease: async (
    projectId: string,
    payload: { version: string; name?: string; description?: string; targetDate?: string },
  ): Promise<ReleaseSummary> => {
    return request<ReleaseSummary>(`/projects/${projectId}/releases`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateRelease: async (
    releaseId: string,
    payload: {
      version?: string;
      name?: string;
      description?: string | null;
      targetDate?: string | null;
      releaseNotes?: string | null;
    },
  ): Promise<ReleaseSummary> => {
    return request<ReleaseSummary>(`/releases/${releaseId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteRelease: async (releaseId: string): Promise<{ success: boolean; message: string }> => {
    return request(`/releases/${releaseId}`, { method: 'DELETE' });
  },

  updateReleaseStatus: async (
    releaseId: string,
    payload: { status: Exclude<ReleaseStatus, 'RELEASED'>; acknowledgeRisks?: boolean },
  ): Promise<ReleaseSummary> => {
    return request<ReleaseSummary>(`/releases/${releaseId}/status`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  shipRelease: async (
    releaseId: string,
    payload: { rolloverTo: 'RELEASE' | 'NONE'; rolloverReleaseId?: string; acknowledgeRisks?: boolean },
  ): Promise<ReleaseShipResult> => {
    return request<ReleaseShipResult>(`/releases/${releaseId}/ship`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getReleaseReadiness: async (releaseId: string): Promise<ReleaseReadinessReport> => {
    return request<ReleaseReadinessReport>(`/releases/${releaseId}/readiness`);
  },

  assessReleaseReadiness: async (releaseId: string): Promise<ReleaseReadinessReport> => {
    return request<ReleaseReadinessReport>(`/releases/${releaseId}/readiness/assess`, { method: 'POST' });
  },

  generateReleaseNotes: async (releaseId: string): Promise<ReleaseNotesDraft> => {
    return request<ReleaseNotesDraft>(`/releases/${releaseId}/notes/generate`, { method: 'POST' });
  },

  // Issue dependencies
  listDependencies: async (issueId: string): Promise<IssueDependencyLink[]> => {
    return request<IssueDependencyLink[]>(`/issues/${issueId}/dependencies`);
  },

  addDependency: async (issueId: string, payload: { kind: IssueLinkKind; targetIssue: string }): Promise<IssueDependencyLink> => {
    return request<IssueDependencyLink>(`/issues/${issueId}/dependencies`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  removeDependency: async (dependencyId: string): Promise<{ success: boolean }> => {
    return request(`/issue-dependencies/${dependencyId}`, { method: 'DELETE' });
  },

  // Bulk changes (dry run = diff preview)
  bulkUpdateIssues: async (
    projectId: string,
    payload: { operations: BulkIssueOperation[]; dryRun?: boolean; source?: BulkChangeSource },
  ): Promise<BulkChangePreview> => {
    return request<BulkChangePreview>(`/projects/${projectId}/issues/bulk-update`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Activities & Attachments
  listActivities: async (issueId: string): Promise<any[]> => {
    return request<any[]>(`/issues/${issueId}/activity`);
  },

  listAttachments: async (issueId: string): Promise<any[]> => {
    return request<any[]>(`/issues/${issueId}/attachments`);
  },

  addAttachment: async (issueId: string, payload: { fileName: string; fileSize: number; mimeType: string; s3Key: string; s3Url: string }): Promise<any> => {
    return request<any>(`/issues/${issueId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

