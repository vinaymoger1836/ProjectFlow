import { Issue, IssuePriority, IssueType } from '@projectflow/types';

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

