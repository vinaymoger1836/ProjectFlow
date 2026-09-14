'use client';

import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { SlidersHorizontal, Check } from 'lucide-react';
import { Table } from '@tanstack/react-table';

interface ColumnVisibilityMenuProps<TData> {
  table: Table<TData>;
}

export function ColumnVisibilityMenu<TData>({ table }: ColumnVisibilityMenuProps<TData>) {
  const allLeafColumns = table.getAllLeafColumns();

  // Column labels for human-readable display
  const columnLabels: Record<string, string> = {
    issueKey: 'Issue Key',
    title: 'Title',
    type: 'Type',
    status: 'Status',
    priority: 'Priority',
    assignee: 'Assignee',
    storyPoints: 'Story Points',
    dueDate: 'Due Date',
    createdAt: 'Created At',
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card text-foreground hover:bg-muted transition-colors shadow-sm"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Columns</span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[180px] rounded-lg border border-border bg-popover p-1.5 shadow-xl text-popover-foreground animate-fade-in"
        >
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border/50 mb-1">
            Toggle Visible Columns
          </div>

          {allLeafColumns
            .filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide())
            .map((column) => {
              const isVisible = column.getIsVisible();
              const label = columnLabels[column.id] || column.id;

              return (
                <DropdownMenu.CheckboxItem
                  key={column.id}
                  checked={isVisible}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-xs font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                >
                  <div className="mr-2 flex h-3.5 w-3.5 items-center justify-center rounded border border-border bg-background">
                    {isVisible && <Check className="h-3 w-3 text-primary stroke-[3]" />}
                  </div>
                  <span>{label}</span>
                </DropdownMenu.CheckboxItem>
              );
            })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
