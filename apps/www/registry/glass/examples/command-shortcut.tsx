'use client';

import * as React from 'react';
import { Command, type CommandItem } from '@/components/ui/command';

const ITEMS: CommandItem[] = [
  { id: 'home', label: '回到首页', group: '导航', keywords: ['index', 'shouye'] },
  { id: 'docs', label: '组件文档', group: '导航', keywords: ['components'] },
  { id: 'metrics', label: 'Apple 度量表', group: '资料', keywords: ['metrics', 'duliang'] },
  { id: 'status', label: '阶段状态', group: '资料', keywords: ['status'] },
];

/**
 * ⌘K / Ctrl+K 唤起。
 *
 * ⚠️ **快捷键是这个示例接的，不是组件自带的。** 组件只管开合与列表 ——
 * 全局快捷键属于应用层决定（要不要拦、在哪些页面拦、与其他快捷键冲不冲），
 * 塞进组件会让调用方没法关掉。
 *
 * 搜索支持 `keywords`：打 "shouye" 也能找到「回到首页」。
 * ⚠️ 但**没有模糊匹配、没有权重排序** —— Spotlight 有那些，本库没有。
 */
export default function CommandShortcut() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-[15px] text-[var(--lg-label-primary)]">
        按 <kbd className="rounded bg-[var(--lg-fill-tertiary)] px-1.5 py-0.5">⌘K</kbd> 唤起
      </span>
      <Command items={ITEMS} open={open} onOpenChange={setOpen} label="快速跳转" />
    </div>
  );
}
