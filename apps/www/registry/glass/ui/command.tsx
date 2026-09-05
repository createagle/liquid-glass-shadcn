'use client';

// APPLE REFERENCE: **没有 —— 而且这一次是结构上不可能有。**
//
// `Command`（命令面板）对应的是 **Spotlight**，那是**系统级**的界面：
// App 画不出来，所以 Apple 的设计资源里当然不会有它的样例。
// 这与 Toast 的「系统通知横幅」是同一类 —— 不是「没找到」，是**不会有**。
// 逐页确认过：iOS 39 页、macOS 39 页，都没有命令面板。记录见 §15.2。
//
// ── 唯一有实测依据的一半：搜索框 ──────────────────────────────────────
//
//   macOS `480:760 Search Field`（6 个状态）：
//
//     胶囊，控件高 24，左右内边距 8，元素间距 2
//     放大镜 `􀊫` Medium 13，框 16×15，#000000 @ 0.85
//     文本 Medium 13 / 行高 16，#000000 @ 0.85
//     清除 `􀁡` Medium 13，框 16×15，#000000 @ **0.5**
//     文本光标 2 × 18，r=100，**#0088ff**
//
//   ⚠️ **尺度照旧不取**（同 Sidebar / Combobox）：24 高、13 号字是鼠标语境，
//     本库基准是 iOS。取的是**结构与比例** —— 放大镜在前、清除在后、
//     胶囊、光标是蓝的。尺寸走本库既有的 Input 与 DropdownMenu。
//
// ── 其余部分全部 `[推定]`，逐条写明借自哪里 ────────────────────────────
//
//     面板圆角 / 内边距 / 项高 / 项圆角   借 `MENU_GEOMETRY`（§7.7 实测）
//     搜索框结构与配色                     借 macOS Search Field（§15.2 实测）
//     分组标题                             借 DropdownMenu 的 Label（本身也是推定）
//
//   与 Breadcrumb（P2 第二批）、Navigation Menu（第三批）同一档处理：
//   **借来的实测值仍然是 `[推定]`** —— 值可靠，但「用在这里」没有依据。
//
// ── 无障碍：与 Combobox 同一套模式，全部手写 ──────────────────────────
//
//   `role="combobox"` + `aria-activedescendant`，**焦点始终留在输入框上**。
//   把焦点挪进列表就没法继续打字了 —— 这正是命令面板的核心交互。
//
// ⚠️ 分层：面板 = **Layer B**（elevated）；搜索框与项都是内容层填充，不是玻璃。

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { GlassSurface, transitionFor, useGlassOptional } from '@glass/core';
import { MENU_GEOMETRY } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export const COMMAND_GEOMETRY = {
  /** 面板宽（px）。`[推定]` —— 无来源。取 560，够放两列信息又不至于横跨全屏 */
  width: 560,
  /** 面板圆角（px）。`[推定]` —— 借 §7.7 菜单面板的实测 34 */
  radius: MENU_GEOMETRY.radius,
  /** 面板上下内边距（px）。`[推定]` —— 借 §7.7 的实测 10 */
  paddingBlock: MENU_GEOMETRY.paddingBlock,
  /** 面板左右内边距（px）。`[推定]` —— 借 §7.7 的实测 16 */
  paddingInline: MENU_GEOMETRY.paddingInline,
  /** 项高（px）。`[推定]` —— 借 §7.7 的实测 40 */
  itemHeight: MENU_GEOMETRY.itemHeight,
  /** 项圆角（px）。`[推定]` —— 借 §7.7 的 10（那一条本身也是推定） */
  itemRadius: MENU_GEOMETRY.itemRadius,
  /** 项字号（px）。`[推定]` —— 借本库正文 17 */
  fontSize: 17,
  /** 搜索框高（px）。`[推定]` —— 借本库 Input 的 field 变体 44（macOS 那份是 24） */
  searchHeight: 44,
  /** 搜索框与放大镜/清除之间的间距（px）。`[推定]` —— macOS 是 2 对 24 高，按比例放大 */
  searchGap: 8,
  /** 放大镜边长（px）。`[推定]` —— macOS 是 16 对 24 高，按比例放大 */
  iconSize: 20,
  /** 分组标题字号（px）。`[推定]` —— 借 DropdownMenu 的 Label（13，本身也是推定） */
  groupFontSize: 13,
  /** 列表最大高（px）。`[推定]` —— 无来源，取 8 项 */
  listMaxHeight: 8 * MENU_GEOMETRY.itemHeight,
} as const;

export interface CommandItem {
  id: string;
  label: string;
  /** 分组标题。同一个 group 的项会排在一起，顺序按首次出现。 */
  group?: string;
  /** 右侧快捷键提示。 */
  shortcut?: string;
  disabled?: boolean;
  /** 除了 label 之外还想被搜到的词。 */
  keywords?: readonly string[];
}

export interface GlassCommandProps {
  items: readonly CommandItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (item: CommandItem) => void;
  placeholder?: string;
  /** 面板的无障碍名称。Radix Dialog 要求必须有。 */
  label?: string;
  empty?: React.ReactNode;
  /**
   * 过滤函数。默认是对 `label` + `keywords` 的大小写不敏感子串匹配。
   *
   * ⚠️ **没有模糊匹配、没有拼音、没有权重排序。** Spotlight 有那些，本库没有 ——
   * 那需要一套评分模型，而这里连一张参考图都没有。要就自己传。
   */
  filter?: (item: CommandItem, query: string) => boolean;
}

const defaultFilter = (item: CommandItem, q: string) => {
  const needle = q.toLowerCase();
  if (item.label.toLowerCase().includes(needle)) return true;
  return (item.keywords ?? []).some((k) => k.toLowerCase().includes(needle));
};

function Command({
  items,
  open,
  onOpenChange,
  onSelect,
  placeholder = '搜索…',
  label = '命令面板',
  empty = '没有匹配项',
  filter = defaultFilter,
}: GlassCommandProps) {
  const id = React.useId();
  const reduced = useGlassOptional()?.preferences.reducedMotion ?? false;
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const visible = React.useMemo(
    () => (query === '' ? items : items.filter((i) => filter(i, query))),
    [items, query, filter],
  );

  /*
   * 分组：按**首次出现**的顺序，不按字母序 ——
   * 调用方给的顺序通常本身有意义（常用的排前面）。
   */
  const groups = React.useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of visible) {
      const key = item.group ?? '';
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()];
  }, [visible]);

  /** 扁平顺序 —— 键盘导航按这个走，与视觉顺序一致。 */
  const flat = React.useMemo(() => groups.flatMap(([, list]) => list), [groups]);

  // 每次改查询词都把高亮拉回第一项，否则会停在一个已经被过滤掉的位置
  React.useEffect(() => {
    setActive(0);
  }, [query]);

  // 打开时清空 —— 上次搜过的词留着会让人以为是结果，不是残留
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const move = (delta: number) => {
    if (flat.length === 0) return;
    let next = active;
    for (let step = 0; step < flat.length; step += 1) {
      next = (next + delta + flat.length) % flat.length;
      if (!flat[next]?.disabled) break;
    }
    setActive(next);
    /*
     * 高亮跟着滚。`block: 'nearest'` 而不是 `center` ——
     * 后者会在按一下方向键时把整个列表甩到中间，看着像跳了一大格。
     */
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-index="${next}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  };

  const commit = (item: CommandItem | undefined) => {
    if (!item || item.disabled) return;
    onSelect?.(item);
    onOpenChange(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(flat[active]);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActive(event.key === 'Home' ? 0 : flat.length - 1);
    }
  };

  const activeId = flat[active] ? `${id}-opt-${flat[active]!.id}` : undefined;
  let index = -1;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay
              forceMount
              data-slot="command-overlay"
              className="fixed inset-0 z-50"
            >
              <motion.div
                className="absolute inset-0"
                style={{ background: 'var(--lg-scrim)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transitionFor('smooth', reduced)}
              />
            </DialogPrimitive.Overlay>

            <DialogPrimitive.Content
              forceMount
              data-slot="command-content"
              /*
               * 竖直方向**不居中**，压在上三分之一 ——
               * Spotlight 就在那个位置，而且列表往下长时面板不会跟着往上挪。
               * `[推定]`，没有可量的来源。
               */
              className="fixed top-[18vh] left-1/2 z-50 -translate-x-1/2 outline-none"
              onOpenAutoFocus={(e) => {
                // 让焦点落到输入框，而不是面板本身
                e.preventDefault();
                (e.currentTarget as HTMLElement)
                  .querySelector<HTMLInputElement>('[data-slot="command-input"]')
                  ?.focus();
              }}
            >
              <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={transitionFor('bouncy', reduced)}
              >
                <GlassSurface
                  layer="elevated"
                  radius={COMMAND_GEOMETRY.radius}
                  continuous
                  className="overflow-hidden"
                  style={{
                    width: COMMAND_GEOMETRY.width,
                    paddingBlock: COMMAND_GEOMETRY.paddingBlock,
                    paddingInline: COMMAND_GEOMETRY.paddingInline,
                  }}
                >
                  {/* ── 搜索框 ── */}
                  <div
                    className="flex items-center"
                    style={{
                      height: COMMAND_GEOMETRY.searchHeight,
                      gap: COMMAND_GEOMETRY.searchGap,
                    }}
                    data-slot="command-search"
                  >
                    <MagnifyingGlass />
                    <input
                      role="combobox"
                      type="text"
                      aria-expanded="true"
                      aria-controls={`${id}-list`}
                      aria-autocomplete="list"
                      aria-label={label}
                      {...(activeId ? { 'aria-activedescendant': activeId } : {})}
                      value={query}
                      placeholder={placeholder}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={onKeyDown}
                      className={cn(
                        'min-w-0 flex-1 bg-transparent text-[var(--lg-label-primary)] outline-none',
                        'placeholder:text-[var(--lg-label-tertiary)]',
                        // [实测] macOS 的搜索框光标是蓝的
                        'caret-[var(--lg-blue)]',
                      )}
                      style={{ fontSize: COMMAND_GEOMETRY.fontSize }}
                      data-slot="command-input"
                    />
                    {query !== '' ? (
                      <button
                        type="button"
                        aria-label="清除"
                        onClick={() => setQuery('')}
                        // [实测] 清除按钮是 0.5 不透明度，比放大镜的 0.85 淡
                        className="shrink-0 text-[var(--lg-label-tertiary)]"
                        data-slot="command-clear"
                      >
                        <ClearIcon />
                      </button>
                    ) : null}
                  </div>

                  <Separator />

                  {/* ── 列表 ── */}
                  <div
                    ref={listRef}
                    id={`${id}-list`}
                    role="listbox"
                    aria-label={label}
                    className="overflow-y-auto"
                    style={{ maxHeight: COMMAND_GEOMETRY.listMaxHeight }}
                    data-slot="command-list"
                  >
                    {flat.length === 0 ? (
                      <div
                        className="flex items-center justify-center text-[var(--lg-label-secondary)]"
                        style={{
                          minHeight: COMMAND_GEOMETRY.itemHeight,
                          fontSize: COMMAND_GEOMETRY.fontSize,
                        }}
                        data-slot="command-empty"
                      >
                        {empty}
                      </div>
                    ) : (
                      groups.map(([group, list]) => (
                        <div key={group || '__none__'} data-slot="command-group">
                          {group ? (
                            <div
                              className="flex items-center text-[var(--lg-label-secondary)]"
                              style={{
                                minHeight: COMMAND_GEOMETRY.itemHeight,
                                fontSize: COMMAND_GEOMETRY.groupFontSize,
                                paddingInline: MENU_GEOMETRY.separatorInset,
                              }}
                              data-slot="command-group-label"
                            >
                              {group}
                            </div>
                          ) : null}
                          {list.map((item) => {
                            index += 1;
                            const i = index;
                            return (
                              <div
                                key={item.id}
                                id={`${id}-opt-${item.id}`}
                                role="option"
                                aria-selected={i === active}
                                aria-disabled={item.disabled || undefined}
                                data-index={i}
                                data-slot="command-item"
                                data-active={i === active ? 'true' : undefined}
                                onPointerMove={() => !item.disabled && setActive(i)}
                                onClick={() => commit(item)}
                                className={cn(
                                  'flex cursor-default items-center gap-2 transition-colors duration-100',
                                  'text-[var(--lg-label-primary)]',
                                  item.disabled && 'pointer-events-none opacity-40',
                                )}
                                style={{
                                  minHeight: COMMAND_GEOMETRY.itemHeight,
                                  borderRadius: COMMAND_GEOMETRY.itemRadius,
                                  paddingInline: MENU_GEOMETRY.separatorInset,
                                  fontSize: COMMAND_GEOMETRY.fontSize,
                                  backgroundColor:
                                    i === active ? 'var(--lg-fill-tertiary)' : 'transparent',
                                }}
                              >
                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                {item.shortcut ? (
                                  <span
                                    aria-hidden="true"
                                    className="shrink-0 text-[var(--lg-label-tertiary)]"
                                    data-slot="command-shortcut"
                                  >
                                    {item.shortcut}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                </GlassSurface>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

/** 搜索框与列表之间的分隔线 —— 三个数与 DropdownMenu 共用同一份常量。 */
function Separator() {
  return (
    <div className="relative" style={{ height: MENU_GEOMETRY.separatorZone }} aria-hidden="true">
      <span
        className="absolute block bg-[var(--lg-separator)]"
        style={{
          top: MENU_GEOMETRY.separatorOffset,
          left: MENU_GEOMETRY.separatorInset,
          right: MENU_GEOMETRY.separatorInset,
          height: 1,
        }}
      />
    </div>
  );
}

/**
 * 放大镜与清除图标 —— 自己画的 SVG。
 *
 * ⚠️ 资源里这两个是 SF Symbols 的私有区码位（`􀊫` / `􀁡`），
 * Web 上没有那套字体，直接渲染是豆腐块。
 * 与 Collapsible / Sidebar / Calendar 同一个坑，第四次了。
 */
function MagnifyingGlass() {
  const s = COMMAND_GEOMETRY.iconSize;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-[var(--lg-label-secondary)]"
      data-slot="command-search-icon"
    >
      <circle cx="8.5" cy="8.5" r="6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13 13L18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ClearIcon() {
  const s = COMMAND_GEOMETRY.iconSize;
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="currentColor" />
      <path
        d="M7.2 7.2L12.8 12.8M12.8 7.2L7.2 12.8"
        stroke="var(--lg-card-fill)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export { Command };
