'use client';

import React, { useState } from 'react';
import { PieChart as PieIcon, BarChart2, TrendingUp } from 'lucide-react';
import { CopilotChartBlock, CopilotChartDataPoint } from '@/lib/api';
import { cn } from '@/lib/utils';

interface GenerativeChartProps {
  block: CopilotChartBlock;
}

const DEFAULT_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#EF4444', // Rose
  '#8B5CF6', // Purple
  '#64748B', // Slate
  '#06B6D4', // Cyan
  '#EC4899', // Pink
];

export function GenerativeChart({ block }: GenerativeChartProps) {
  const { chartType, title, subtitle, data = [], unit = '' } = block;
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total =
    block.total !== undefined
      ? block.total
      : data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  if (!data || data.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/80 bg-card/95 shadow-sm p-3.5 space-y-3 text-xs animate-fade-in my-1.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-primary/15 text-primary flex items-center justify-center">
            {chartType === 'pie' ? (
              <PieIcon className="h-3 w-3" />
            ) : chartType === 'line' ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <BarChart2 className="h-3 w-3" />
            )}
          </div>
          <div>
            <div className="font-semibold text-foreground text-xs leading-none">{title}</div>
            {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
          </div>
        </div>
        {total > 0 && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
            Total: <strong className="text-foreground">{total}</strong> {unit}
          </span>
        )}
      </div>

      {/* Chart Body */}
      {chartType === 'pie' && (
        <DonutChart
          data={data}
          total={total}
          hoveredIdx={hoveredIdx}
          onHover={setHoveredIdx}
          unit={unit}
        />
      )}

      {chartType === 'bar' && (
        <HorizontalBarChart
          data={data}
          total={total}
          hoveredIdx={hoveredIdx}
          onHover={setHoveredIdx}
          unit={unit}
        />
      )}

      {chartType === 'line' && (
        <LineChart
          data={data}
          hoveredIdx={hoveredIdx}
          onHover={setHoveredIdx}
          unit={unit}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Donut / Pie Chart Component (Pure SVG, Responsive, No Libs)
// -------------------------------------------------------------
function DonutChart({
  data,
  total,
  hoveredIdx,
  onHover,
  unit,
}: {
  data: CopilotChartDataPoint[];
  total: number;
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
  unit: string;
}) {
  const size = 120;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
      {/* SVG Donut */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />

          {/* Slices */}
          {data.map((item, idx) => {
            const val = Math.max(0, Number(item.value) || 0);
            const percent = total > 0 ? val / total : 0;
            const strokeDasharray = `${percent * circumference} ${circumference}`;
            const strokeDashoffset = -cumulativePercent * circumference;
            cumulativePercent += percent;

            const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={`slice-${idx}`}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={color}
                strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => onHover(idx)}
                onMouseLeave={() => onHover(null)}
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-base font-bold font-mono text-foreground leading-none">
            {hoveredIdx !== null ? data[hoveredIdx].value : total}
          </span>
          <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
            {hoveredIdx !== null ? data[hoveredIdx].label : 'Total'}
          </span>
        </div>
      </div>

      {/* Legend & Details */}
      <div className="flex-1 w-full grid grid-cols-2 gap-2 text-xs">
        {data.map((item, idx) => {
          const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
          const val = Number(item.value) || 0;
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={`legend-${idx}`}
              onMouseEnter={() => onHover(idx)}
              onMouseLeave={() => onHover(null)}
              className={cn(
                'flex items-center justify-between p-1.5 rounded-lg border transition-colors cursor-pointer',
                isHovered
                  ? 'bg-muted/70 border-foreground/30 shadow-xs'
                  : 'bg-muted/20 border-transparent hover:bg-muted/40',
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0 pr-1">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate text-[11px] font-medium text-foreground">
                  {item.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1 shrink-0 font-mono text-[11px]">
                <span className="font-bold text-foreground">{val}</span>
                <span className="text-[9px] text-muted-foreground">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Horizontal Bar Chart Component
// -------------------------------------------------------------
function HorizontalBarChart({
  data,
  total,
  hoveredIdx,
  onHover,
  unit,
}: {
  data: CopilotChartDataPoint[];
  total: number;
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
  unit: string;
}) {
  const maxVal = Math.max(...data.map((d) => Number(d.value) || 0), 1);

  return (
    <div className="space-y-2 pt-1">
      {data.map((item, idx) => {
        const val = Number(item.value) || 0;
        const widthPct = Math.round((val / maxVal) * 100);
        const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
        const isHovered = hoveredIdx === idx;

        return (
          <div
            key={`bar-${idx}`}
            onMouseEnter={() => onHover(idx)}
            onMouseLeave={() => onHover(null)}
            className={cn(
              'p-1.5 rounded-lg transition-colors cursor-pointer group',
              isHovered ? 'bg-muted/60' : 'hover:bg-muted/30',
            )}
          >
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-medium text-foreground truncate">{item.label}</span>
              <span className="font-mono font-bold text-foreground shrink-0">
                {val} {unit}
              </span>
            </div>

            {/* Bar Track */}
            <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(widthPct, 2)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------------
// Line / Trend Chart Component (Pure SVG Curve + Gradient)
// -------------------------------------------------------------
function LineChart({
  data,
  hoveredIdx,
  onHover,
  unit,
}: {
  data: CopilotChartDataPoint[];
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
  unit: string;
}) {
  const width = 280;
  const height = 90;
  const paddingX = 15;
  const paddingY = 12;

  const values = data.map((d) => Number(d.value) || 0);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const points = data.map((item, idx) => {
    const x = paddingX + (idx / Math.max(data.length - 1, 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((Number(item.value) - minVal) / range) * (height - paddingY * 2);
    return { x, y, label: item.label, value: item.value };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;

  return (
    <div className="space-y-2 pt-1">
      <div className="relative w-full flex justify-center">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[90px] overflow-visible"
        >
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines */}
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeDasharray="3 3"
          />
          <line
            x1={paddingX}
            y1={paddingY}
            x2={width - paddingX}
            y2={paddingY}
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeDasharray="3 3"
          />

          {/* Gradient Area Fill */}
          <path d={areaD} fill="url(#lineGrad)" />

          {/* Stroke Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g key={`pt-${idx}`}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 4.5 : 3}
                  fill="#3B82F6"
                  stroke="#FFFFFF"
                  strokeWidth={isHovered ? 2 : 1}
                  className="transition-all cursor-pointer"
                  onMouseEnter={() => onHover(idx)}
                  onMouseLeave={() => onHover(null)}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Point Tooltip / Hover Bar */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 border-t border-border/40 pt-1.5">
        <span>{data[0]?.label}</span>
        {hoveredIdx !== null ? (
          <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
            {data[hoveredIdx].label}: {data[hoveredIdx].value} {unit}
          </span>
        ) : (
          <span className="text-[10px] italic">Hover points to inspect</span>
        )}
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
