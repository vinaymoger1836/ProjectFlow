'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GenerativeMarkdownProps {
  content: string;
  className?: string;
  onOpenIssue?: (issueKey: string) => void;
}

export function GenerativeMarkdown({
  content,
  className,
  onOpenIssue,
}: GenerativeMarkdownProps) {
  if (!content) return null;

  // Split content by lines
  const lines = content.split('\n');

  const renderInline = (text: string): React.ReactNode => {
    // Regex matching issue keys like [ENG-12] or `[ENG-12]` or ENG-12
    // Also matching **bold**, *italic*, and `code`
    const tokenRegex = /(\*\*.*?\*\*|\*.*?\*|`\[?[A-Z]{2,10}-\d+\]?`|\[[A-Z]{2,10}-\d+\]|\b[A-Z]{2,10}-\d+\b|`.*?`)/g;

    const parts = text.split(tokenRegex);

    return parts.map((part, index) => {
      if (!part) return null;

      // Bold: **text**
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={index} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }

      // Italic: *text*
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2 && !part.startsWith('**')) {
        return (
          <em key={index} className="italic text-muted-foreground">
            {part.slice(1, -1)}
          </em>
        );
      }

      // Issue Key: [ENG-123] or `[ENG-123]` or ENG-123
      const keyMatch = part.match(/`?\[?([A-Z]{2,10}-\d+)\]?`?/);
      if (keyMatch && keyMatch[1] && onOpenIssue) {
        const issueKey = keyMatch[1];
        return (
          <button
            key={index}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenIssue(issueKey);
            }}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-mono font-bold text-[11px] text-primary bg-primary/10 hover:bg-primary/20 hover:underline border border-primary/25 transition-colors align-baseline mx-0.5"
            title={`Open ${issueKey} in Drawer`}
          >
            <span>{issueKey}</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-70" />
          </button>
        );
      }

      // Code: `code`
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={index}
            className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground border border-border/60 mx-0.5"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className={cn('space-y-2 leading-relaxed text-xs', className)}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Empty line
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Heading 3: ### Title
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-bold text-foreground text-xs pt-1">
              {renderInline(trimmed.slice(4))}
            </h4>
          );
        }

        // Heading 2: ## Title
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="font-bold text-foreground text-sm pt-1">
              {renderInline(trimmed.slice(3))}
            </h3>
          );
        }

        // Bullet item: - or *
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
              <div className="flex-1">{renderInline(trimmed.slice(2))}</div>
            </div>
          );
        }

        // Numbered list item: e.g. 1.
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="font-mono text-[10px] text-muted-foreground font-bold shrink-0 mt-0.5">
                {numMatch[1]}.
              </span>
              <div className="flex-1">{renderInline(numMatch[2])}</div>
            </div>
          );
        }

        // Standard paragraph
        return (
          <p key={idx} className="leading-relaxed">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}
