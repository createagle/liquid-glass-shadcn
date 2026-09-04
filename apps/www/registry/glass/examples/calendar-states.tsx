'use client';

import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';

/**
 * 四种日期格状态。
 *
 * ⚠️ **选中态是黑底白字，不是主题蓝** —— 实测就是这样，
 * 只有「今天且被选中」才是蓝底。多数 Web 日历把选中画成主题色，这里刻意不跟。
 *
 * 另外周末与工作日一视同仁：资源里没有为周末单独画一档。
 */
export default function CalendarStates() {
  const today = new Date(2026, 3, 8);
  return (
    <div className="flex flex-col items-center gap-3">
      <Calendar
        // 选中的不是今天 → 黑底白字；今天（8 号）是蓝字 + 12% 蓝底
        defaultSelected={new Date(2026, 3, 15)}
        today={today}
        month={new Date(2026, 3, 1)}
        // 周末不可选 —— 演示 disabled 回调
        disabled={(d) => d.getDay() === 0 || d.getDay() === 6}
      />
      <span className="text-[13px] text-[var(--lg-label-secondary)]">
        8 号 = 今天（蓝）· 15 号 = 选中（黑底白字）· 周末不可选
      </span>
    </div>
  );
}
