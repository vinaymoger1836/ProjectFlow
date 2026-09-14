'use client';

import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  SortingState,
  VisibilityState,
  flexRender,
} from '@tanstack/react-table';
import {
  Search,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Inbox,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
} from 'lucide-react';
import { IssueTypeBadge, IssuePriorityBadge, IssueStatusBadge } from './badge-helpers';
import { ColumnVisibilityMenu } from './column-visibility-menu';
import { PaginatedIssues } from '@/lib/api';
import { IssuePriority, IssueType } from '@projectflow/types';

type IssueItem = PaginatedIssues['items'][0];

interface IssueTableProps {
  issues: IssueItem[];
  isLoading: boolean;
  onSelectIssue: (issueKey: string) => void;
  onOpenCreateModal: () => void;
}

export function IssueTable({
  issues,
  isLoading,
  onSelectIssue,
  onOpenCreateModal,
}: IssueTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'issueKey', desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Column visibility state (toggleable in UI)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    issueKey: true,
    type: true,
    title: true,
    status: true,
    priority: true,
    assignee: true,
    storyPoints: true,
    dueDate: true,
    createdAt: false, // Default hidden for cleaner initial view
  });

  // Filtered issues based on dropdowns
  const filteredData = useMemo(() => {
    return issues.filter((item) => {
      if (statusFilter !== 'ALL' && item.status.toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }
      if (priorityFilter !== 'ALL' && item.priority !== priorityFilter) {
        return false;
      }
      if (typeFilter !== 'ALL' && item.type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [issues, statusFilter, priorityFilter, typeFilter]);

  // Column definitions
  const columns = useMemo<ColumnDef<IssueItem>[]>(
    () => [
      {
        accessorKey: 'issueKey',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-foreground font-semibold"
          >
            <span>Key</span>
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3 w-3 text-primary" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3 w-3 text-primary" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-40" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-bold text-primary hover:underline">
            {row.original.issueKey}
          </span>
        ),
        size: 90,
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => <IssueTypeBadge type={row.original.type} />,
        size: 95,
      },
      {
        accessorKey: 'title',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-foreground font-semibold"
          >
            <span>Title</span>
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3 w-3 text-primary" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3 w-3 text-primary" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-40" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 max-w-md">
            <span className="font-medium text-foreground truncate hover:text-primary transition-colors">
              {row.original.title}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <IssueStatusBadge status={row.original.status} />,
        size: 110,
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ row }) => <IssuePriorityBadge priority={row.original.priority} />,
        size: 105,
      },
      {
        accessorKey: 'assignee',
        header: 'Assignee',
        cell: ({ row }) => {
          const a = row.original.assignee;
          if (!a) {
            return (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserIcon className="h-3.5 w-3.5 opacity-40" />
                <span>Unassigned</span>
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                {a.name[0]?.toUpperCase() || 'U'}
              </span>
              <span className="truncate max-w-[120px]">{a.name}</span>
            </span>
          );
        },
        size: 140,
      },
      {
        accessorKey: 'storyPoints',
        header: 'Points',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground font-mono">
            {row.original.storyPoints !== null && row.original.storyPoints !== undefined ? (
              <span className="px-1.5 py-0.5 rounded bg-muted font-semibold text-foreground">
                {row.original.storyPoints}
              </span>
            ) : (
              '—'
            )}
          </span>
        ),
        size: 70,
      },
      {
        accessorKey: 'dueDate',
        header: 'Due Date',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.dueDate
              ? new Date(row.original.dueDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              : '—'}
          </span>
        ),
        size: 100,
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        ),
        size: 90,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  });

  return (
    <div className="space-y-4">
      {/* Table Toolbar Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Global Search Input */}
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search issues..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground shadow-sm"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-card border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary text-foreground shadow-sm cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="TODO">Todo</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="DONE">Done</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs bg-card border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary text-foreground shadow-sm cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="P0">P0 Urgent</option>
            <option value="P1">P1 High</option>
            <option value="P2">P2 Medium</option>
            <option value="P3">P3 Low</option>
            <option value="P4">P4 None</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs bg-card border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary text-foreground shadow-sm cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="TASK">Task</option>
            <option value="BUG">Bug</option>
            <option value="STORY">Story</option>
            <option value="EPIC">Epic</option>
            <option value="SUBTASK">Subtask</option>
          </select>
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-2">
          {/* Column Visibility Selector (User Requested) */}
          <ColumnVisibilityMenu table={table} />

          {/* Create Issue Action */}
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors"
          >
            <Plus className="h-3.5 w-3.5 stroke-[3]" />
            <span>New Issue</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border bg-muted/40 text-muted-foreground">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="px-4 py-3 font-semibold text-xs tracking-wider uppercase select-none"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={columns.length} className="px-4 py-3.5">
                      <div className="h-4 bg-muted rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-16 text-center">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                        <Inbox className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-sm text-foreground">No issues found</p>
                      <p className="text-xs text-muted-foreground">
                        {globalFilter || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
                          ? 'Try resetting your filters or search query.'
                          : 'Get started by creating the first issue in this project.'}
                      </p>
                      <button
                        type="button"
                        onClick={onOpenCreateModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Create Issue</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onSelectIssue(row.original.issueKey)}
                    className="hover:bg-muted/40 cursor-pointer transition-colors group"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-card">
          <div>
            Showing <span className="font-semibold text-foreground">{table.getRowModel().rows.length}</span> of{' '}
            <span className="font-semibold text-foreground">{filteredData.length}</span> issues
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
            </span>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
