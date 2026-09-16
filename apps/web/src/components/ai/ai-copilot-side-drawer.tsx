'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  RotateCcw,
  PanelRightClose,
  HelpCircle,
} from 'lucide-react';
import { api, ParsedIssueDraft, CopilotWidget, GenerativeBlock } from '@/lib/api';
import { GenerativeBlockRenderer } from './primitives/generative-block-renderer';
import { GenerativeIssueCard } from './generative-issue-card';
import { GenerativeIssueList } from './generative-issue-list';
import { GenerativeMetricsCard } from './generative-metrics-card';
import { GenerativeMarkdown } from './generative-markdown';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  draft?: ParsedIssueDraft;
  widget?: CopilotWidget;
  blocks?: GenerativeBlock[];
  timestamp: Date;
}

interface AiCopilotSideDrawerProps {
  projectId?: string;
  onClose: () => void;
  onOpenIssueInDrawer?: (issueKey: string) => void;
}

export function AiCopilotSideDrawer({
  projectId = '11111111-1111-1111-1111-111111111111',
  onClose,
  onOpenIssueInDrawer,
}: AiCopilotSideDrawerProps) {
  const [inputPrompt, setInputPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hi! I am your ProjectFlow AI Assistant. You can ask me questions about your project (e.g. *"which issues are pending?"*, *"what is our completion rate and bug rate?"*) or ask me to draft a new task, bug, or story in plain language.',
      timestamp: new Date(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new message or thinking
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSendMessage = async (customText?: string) => {
    const text = (customText || inputPrompt).trim();
    if (!text || isThinking) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsThinking(true);

    try {
      const history = messages
        .filter((m) => m.content && m.id !== 'welcome')
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content || '' }));

      const response = await api.chatWithCopilot(projectId, text, history);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        draft: response.draft,
        widget: response.widget,
        blocks: response.blocks,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I encountered an issue analyzing your request: ${err.message || 'Unknown error'}. You can try again or enter details manually.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const samplePrompts = [
    'Which issues are currently pending?',
    'What is our completion rate and bug rate?',
    'Show all active bugs in the project',
    'Create a P0 bug: checkout button double-charges on mobile, estimate 3 hours',
  ];

  return (
    <div className="flex flex-col h-full bg-card text-foreground overflow-hidden">
      {/* Side Drawer Header */}
      <div className="h-16 px-4 border-b border-border flex items-center justify-between bg-card/90 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold shrink-0 shadow-xs">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-xs leading-none truncate">ProjectFlow Copilot</h3>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
            </div>
            <span className="text-[10px] text-muted-foreground truncate block mt-1">
              Groq (120B) / Gemini 2.0 Flash
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() =>
              setMessages([
                {
                  id: 'welcome',
                  role: 'assistant',
                  content:
                    'Conversation cleared. What issue or metric would you like to explore next?',
                  timestamp: new Date(),
                },
              ])
            }
            title="Reset Conversation"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Side Drawer"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chat Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-2.5 max-w-[98%]',
              msg.role === 'user' ? 'ml-auto flex-row-reverse' : '',
            )}
          >
            <div
              className={cn(
                'h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {msg.role === 'user' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
            </div>

            <div className="space-y-2 flex-1 min-w-0">
              {msg.content && (
                <div
                  className={cn(
                    'p-3 rounded-xl leading-relaxed text-xs',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground font-medium rounded-tr-none'
                      : 'bg-muted/50 border border-border/80 text-foreground rounded-tl-none',
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <GenerativeMarkdown
                      content={msg.content}
                      onOpenIssue={onOpenIssueInDrawer}
                    />
                  ) : (
                    msg.content
                  )}
                </div>
              )}

              {/* Composable Generative Blocks (Cards, Charts, Tables) */}
              {msg.blocks && msg.blocks.length > 0 && (
                <div className="space-y-2">
                  {msg.blocks.map((block, bIdx) => (
                    <GenerativeBlockRenderer
                      key={`block-${bIdx}`}
                      block={block}
                      projectId={projectId}
                      onOpenIssueInDrawer={onOpenIssueInDrawer}
                    />
                  ))}
                </div>
              )}

              {/* Backwards-compatible Single Widget fallback */}
              {(!msg.blocks || msg.blocks.length === 0) && msg.widget && (
                <GenerativeBlockRenderer
                  block={msg.widget}
                  projectId={projectId}
                  onOpenIssueInDrawer={onOpenIssueInDrawer}
                />
              )}

              {/* Generative IssueCard Proposal Preview */}
              {(!msg.blocks || msg.blocks.length === 0) && msg.draft && (
                <GenerativeIssueCard
                  projectId={projectId}
                  initialDraft={msg.draft}
                  onIssueCreated={(key) => {
                    if (onOpenIssueInDrawer) {
                      onOpenIssueInDrawer(key);
                    }
                  }}
                />
              )}
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {isThinking && (
          <div className="flex gap-2.5 items-center text-xs text-muted-foreground animate-pulse pl-1">
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-primary animate-spin" />
            </div>
            <span>Thinking and querying project backlog...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Tray (shown when few messages) */}
      {messages.length <= 2 && !isThinking && (
        <div className="px-4 py-2 border-t border-border/40 bg-muted/20 space-y-1.5 shrink-0">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Quick Prompts
          </span>
          <div className="flex flex-col gap-1">
            {samplePrompts.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(p)}
                className="text-left text-[11px] text-muted-foreground hover:text-foreground bg-background hover:bg-muted px-2.5 py-1.5 rounded border border-border/60 truncate transition-colors"
              >
                ✨ {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Composer Input Bar */}
      <div className="p-3 border-t border-border bg-card shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative"
        >
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI or describe an issue (e.g. 'P0 bug on checkout...')"
            className="w-full p-2.5 pr-10 text-xs bg-background border border-input rounded-xl focus:outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isThinking}
            className="absolute right-2.5 bottom-3.5 p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors shadow-xs"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 mt-1">
          <span>Enter to send, Shift+Enter for newline</span>
          <span className="font-mono text-[9px] opacity-75">AI Gateway Active</span>
        </div>
      </div>
    </div>
  );
}
