'use client';

import * as React from 'react';
import { Progress } from '@/components/ui/progress';

export default function ProgressDemo() {
  const [v, setV] = React.useState(38);
  return (
    <div className="flex w-full max-w-[250px] flex-col gap-3">
      <Progress value={v} aria-label="下载进度" />
      <div className="flex items-center justify-between text-[13px] text-[var(--lg-label-secondary)]">
        <span className="tabular-nums">{v}%</span>
        <span className="flex gap-2">
          <button type="button" onClick={() => setV((n) => Math.max(0, n - 20))}>
            −20
          </button>
          <button type="button" onClick={() => setV((n) => Math.min(100, n + 20))}>
            +20
          </button>
        </span>
      </div>
    </div>
  );
}
