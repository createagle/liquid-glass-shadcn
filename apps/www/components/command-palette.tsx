'use client';

/**
 * ⌘K 命令面板 —— PROJECT_SPEC §12：「`⌘K` 命令面板搜索」，
 * 而且「文档站的**搜索面板**必须用本库组件搭建」。
 *
 * 面板本身是本库的 `Dialog`（Layer B elevated 面板），
 * 结果列表是 `Card` + `CardRow`（iOS 分组列表），高亮项是 `GlassSurface`
 * 的 Layer I —— 与 DropdownMenu / Select 的高亮项同一层材质。
 *
 * ── 为什么不用 cmdk ──────────────────────────────────────────────────
 *
 * shadcn 生态的 Command 组件底层是 `cmdk`，它自带一套 DOM 结构与
 * `[cmdk-*]` 属性选择器的样式约定。塞进本库会带来两套并行的结构钩子
 * （`data-slot` 与 `cmdk-*`），而这个面板要的东西一共就三件：
 * 过滤、上下键、回车跳转。自己接三十行，比引一个依赖再和它的结构较劲便宜。
 *
 * ⚠️ **搜索是纯前端的子串匹配**，没有索引、没有模糊匹配、不搜正文。
 * 数据源是 registry.json 的 title/description 加上几条固定路由 ——
 * 够用来当导航，但**不是全文搜索**，这一点写在面板底部，不含糊。
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { GlassSurface, transitionFor, useGlassOptional } from '@createagle/glass-core';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Card, CardRow } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface CommandItem {
  href: string;
  title: string;
  group: string;
  keywords: string;
}

/** 高亮项圆角。与 DropdownMenu / Select 的菜单项取同一个值（那个是 `[推定]`）。 */
const ITEM_RADIUS = 10;

export function CommandPalette({ items }: { items: CommandItem[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;

  /* ⌘K / Ctrl+K 开关 */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.title} ${i.keywords}`.toLowerCase().includes(q));
  }, [items, query]);

  // 结果集变了就把高亮拉回第一条，否则会指向一个已经不存在的下标
  React.useEffect(() => setActive(0), [query]);

  function go(item: CommandItem | undefined) {
    if (!item) return;
    setOpen(false);
    setQuery('');
    router.push(item.href as never);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    }
  }

  return (
    <>
      <button
        type="button"
        data-slot="command-trigger"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] text-[var(--lg-label-secondary)] outline-none hover:text-[var(--lg-label-primary)] focus-visible:ring-2 focus-visible:ring-[var(--lg-ring)]"
        aria-label="搜索文档"
      >
        搜索
        <kbd className="rounded-md px-1.5 py-0.5 font-mono text-[11px] text-[var(--lg-label-tertiary)] ring-1 ring-[var(--lg-separator)] ring-inset">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/*
          ⚠️ **不要写 data-slot** —— DialogContent 在展开 props **之前**设了
          `data-slot="dialog-content"`，这里再给一个会把它顶掉，
          样式与测试赖以定位的结构钩子就断了。全库的约定是另起一个属性。
          （Sheet 的 SheetClose、ResponsiveOverlay 都踩过同一个坑。）
        */}
        <DialogContent width={520} data-command-palette="">
          <DialogTitle className="sr-only">搜索文档</DialogTitle>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索组件与文档…"
            aria-label="搜索组件与文档"
            // 列表用 aria-activedescendant 描述当前项，焦点始终留在输入框
            aria-activedescendant={results[active] ? `cmd-${active}` : undefined}
            aria-controls="command-results"
            role="combobox"
            aria-expanded="true"
            className="w-full border-b border-[var(--lg-separator)] bg-transparent pb-3 text-[17px] outline-none placeholder:text-[var(--lg-label-tertiary)]"
          />

          <div id="command-results" role="listbox" aria-label="搜索结果" className="mt-2">
            {results.length === 0 ? (
              <p className="py-6 text-center text-[15px] text-[var(--lg-label-secondary)]">
                没有匹配的条目
              </p>
            ) : (
              <Card variant="plain" className="max-h-[320px] overflow-y-auto">
                {results.map((item, i) => (
                  <CardRow
                    key={item.href}
                    id={`cmd-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className="relative cursor-pointer"
                    onPointerEnter={() => setActive(i)}
                    onClick={() => go(item)}
                    style={{ borderRadius: ITEM_RADIUS }}
                  >
                    {/*
                      高亮项是 Layer I —— 与菜单项同一层材质。
                      这里**不挖洞**：Dialog 的面板没有为它开这个口子，
                      所以折射看到的是被面板模糊过的背景。属于已知差异，
                      不是「忘了挖」—— 挖洞要面板配合，那是组件 API 的事。
                    */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute inset-0 -z-10 transition-opacity',
                        i === active ? 'opacity-100' : 'opacity-0',
                      )}
                      style={{ transitionDuration: reducedMotion ? '120ms' : '200ms' }}
                    >
                      <GlassSurface
                        layer="indicator"
                        radius={ITEM_RADIUS}
                        className="h-full w-full"
                      />
                    </span>
                    <span className="relative flex-1">{item.title}</span>
                    <span className="relative text-[13px] text-[var(--lg-label-secondary)]">
                      {item.group}
                    </span>
                  </CardRow>
                ))}
              </Card>
            )}
          </div>

          <p className="mt-3 text-[12px] text-[var(--lg-label-tertiary)]">
            ↑ ↓ 选择 · ↵ 打开 · Esc 关闭。
            <br />
            ⚠️ 这是<strong className="font-medium">按标题与描述做的子串匹配</strong>，
            不搜正文、没有模糊匹配 —— 够当导航，但不是全文搜索。
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** transitionFor 在这里只用于统一时长口径，动画本体交给 CSS */
void transitionFor;
