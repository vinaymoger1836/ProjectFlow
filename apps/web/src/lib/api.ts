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
} from '@projectflow/types';

export type {
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
    throw new Error(json.message || json.error?.message || `HTTP error ${res.status}`);
  }

  return json.data ?? json;
}

export const api = {
  // Issues
  listIssues: async (projectId: string, params: IssueQueryParams = {}): Promise<PaginatedIssues> => {
    const searchParams = new URLSearchParams();
    if (params.type) searchParams.set('type', params.type);
    if (params.status) searchParams.set('status', params.status);
    if (params.priority) searchParams.set('priority', params.priority);
    if (params.assigneeId) searchParams.set('assigneeId', params.assigneeId);
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

