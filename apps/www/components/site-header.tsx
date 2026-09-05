'use client';

/**
 * 全局顶栏 —— PROJECT_SPEC §12：「**必须常驻**：明暗切换 + 材质档位滑杆 +
 * Tier 强制切换（开发者可见）」。
 *
 * 三个控件都直接改 `GlassProvider` 的状态，**影响全站**（包括顶栏自己）：
 *   · 明暗   → setTheme，写 .dark / data-glass-theme，落 localStorage
 *   · 材质档位 → setTint，0..1 连续插值，只影响 Layer B（SPEC §8）
 *   · Tier   → setTierOverride，强制走 A / B / C 三条渲染路径中的一条
 *
 * 控件本身用的是**本库自己的组件**（Switch / Slider / Tabs），
 * 这是 SPEC §12「站点必须吃自己的狗粮」的第一处落实：
 * 顶栏一直在动，本库的组件如果有状态残留或重挂问题，这里最先暴露。
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useGlass, tintToStep, GlassSurface } from '@createagle/glass-core';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommandPalette, type CommandItem } from '@/components/command-palette';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: '首页' },
  { href: '/docs', label: '文档' },
  { href: '/docs/components/button', label: '组件' },
] as const;

const TIER_LABEL = {
  a: 'A · 完整折射',
  b: 'B · 无折射',
  c: 'C · 实色',
} as const;

export function SiteHeader({ commands }: { commands: CommandItem[] }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme, tint, setTint, tintStep, tier, tierOverride, setTierOverride } =
    useGlass();

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      {/*
        顶栏本身就是一块 Layer B 底座 —— 站点的第一块玻璃。
        它压在 body 的彩色底纹上，材质档位一拉就能看出差别。
      */}
      <GlassSurface
        layer="base"
        radius={26}
        continuous
        className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-2.5"
      >
        <Link href="/" className="flex items-center gap-2 pr-2 text-[17px] font-semibold">
          Liquid Glass UI
        </Link>

        <nav className="flex items-center gap-1 text-[15px]">
          {NAV.map((n) => {
            const active =
              n.href === '/' ? pathname === '/' : pathname.startsWith(n.href.split('/').slice(0, 3).join('/'));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'rounded-full px-3 py-1.5 transition-colors',
                  active
                    ? 'text-[var(--lg-label-primary)]'
                    : 'text-[var(--lg-label-secondary)] hover:text-[var(--lg-label-primary)]',
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-3">
          {/* ⌘K —— 面板本身是本库的 Dialog + Card（SPEC §12 要求搜索面板也用本库组件） */}
          <CommandPalette items={commands} />

          {/* ── 材质档位 —— SPEC §8 的连续滑杆 ── */}
          <label className="flex items-center gap-3">
            <span className="text-[13px] whitespace-nowrap text-[var(--lg-label-secondary)]">
              材质
            </span>
            <Slider
              className="w-[132px]"
              value={[tint]}
              onValueChange={([v]) => setTint(v ?? 0)}
              min={0}
              max={1}
              step={0.01}
              aria-label="材质档位"
            />
            <span className="w-[52px] text-[13px] tabular-nums text-[var(--lg-label-tertiary)]">
              {tintStep}
            </span>
          </label>

          {/* ── Tier 强制切换 —— 审查 B / C 是不是各自完整的设计 ── */}
          <div className="flex items-center gap-2">
            <span className="text-[13px] whitespace-nowrap text-[var(--lg-label-secondary)]">
              渲染路径
            </span>
            <Tabs
              value={tierOverride ?? 'auto'}
              onValueChange={(v) => setTierOverride(v === 'auto' ? null : (v as 'a' | 'b' | 'c'))}
              height={38}
            >
              <TabsList>
                <TabsTrigger value="auto" className="text-[13px]">
                  自动
                </TabsTrigger>
                {(['a', 'b', 'c'] as const).map((t) => (
                  // 文本本身就写成大写 —— 靠 CSS 的 uppercase 的话，
                  // 可访问名称拿到的仍是小写字母，屏幕阅读器与测试都对不上
                  <TabsTrigger key={t} value={t} className="text-[13px]">
                    {t.toUpperCase()}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <span
              className="w-[86px] text-[13px] text-[var(--lg-label-tertiary)]"
              title={tierOverride ? '已强制' : '运行时探测的结果'}
            >
              {TIER_LABEL[tier]}
            </span>
          </div>

          {/* ── 明暗 ── */}
          <label className="flex items-center gap-2">
            <span className="text-[13px] whitespace-nowrap text-[var(--lg-label-secondary)]">
              {resolvedTheme === 'dark' ? '暗色' : '亮色'}
            </span>
            <Switch
              checked={resolvedTheme === 'dark'}
              onCheckedChange={(on) => setTheme(on ? 'dark' : 'light')}
              aria-label="切换暗色模式"
            />
          </label>
        </div>
      </GlassSurface>
    </header>
  );
}

/** 顶栏用到的档位名，Docs 里也会引用 */
export { tintToStep };
