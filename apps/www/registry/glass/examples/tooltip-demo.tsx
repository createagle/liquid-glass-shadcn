'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * ⚠️ 触屏上 tooltip 是**不可达**的 —— 没有 hover 就永远不会出现。
 * 所以 tooltip 里的信息**永远不能是唯一的信息来源**：
 * 下面每个按钮都自带 `aria-label`，光靠 tooltip 是不够的。
 *
 * 另外注意触发器**自己就是那个按钮**，不要再往里塞一个 `<Button>` ——
 * 本库禁用 asChild，理由见组件顶部。
 */
export default function TooltipDemo() {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-4">
        <Tooltip>
          <TooltipTrigger
            aria-label="复制"
            className="h-11 w-11 bg-[var(--lg-fill-secondary)] text-[17px]"
          >
            ⧉
          </TooltipTrigger>
          <TooltipContent>复制到剪贴板</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            aria-label="分享"
            className="h-11 w-11 bg-[var(--lg-fill-secondary)] text-[17px]"
          >
            ↑
          </TooltipTrigger>
          <TooltipContent side="bottom">分享给其他人</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
