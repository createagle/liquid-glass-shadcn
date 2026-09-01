/**
 * Popover / ResponsiveOverlay 渲染验证台（不是文档站 —— 文档站是 Phase 6）。
 *
 * `?only=popover`     只渲染裸 Popover（永远桌面行为）
 * `?only=responsive`  只渲染 ResponsiveOverlay（按视口切 Popover / Drawer）
 * `?open=1`           一进来就是打开的
 * `?responsive=0`     打开逃生口，强制桌面行为
 * `?side=top|right|bottom|left` · `?align=start|center|end`
 */
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@glass/core';
import { Popover, PopoverTrigger, PopoverContent } from '../registry/glass/ui/popover';
import {
  ResponsiveOverlay,
  ResponsiveOverlayTrigger,
  ResponsiveOverlayContent,
} from '../registry/glass/ui/responsive-overlay';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
const startOpen = params.get('open') === '1';
const responsive = params.get('responsive') !== '0';
const only = params.get('only');
const side = (params.get('side') ?? 'bottom') as 'top' | 'right' | 'bottom' | 'left';
const align = (params.get('align') ?? 'start') as 'start' | 'center' | 'end';

/** 浮层里的内容 —— 用最朴素的按钮列，不引入还没做的 DropdownMenu */
function Items() {
  return (
    <div data-testid="overlay-items" className="flex flex-col">
      {['Cut', 'Copy', 'Paste', 'Add Link'].map((t) => (
        <button
          key={t}
          type="button"
          className="flex items-center text-left outline-none"
          style={{ height: 40, fontSize: 17, color: 'var(--lg-label-primary)' }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function PopoverDemo() {
  return (
    <Popover defaultOpen={startOpen}>
      <PopoverTrigger>打开浮层</PopoverTrigger>
      <PopoverContent side={side} align={align} aria-label="编辑菜单">
        <Items />
      </PopoverContent>
    </Popover>
  );
}

function ResponsiveDemo() {
  return (
    <ResponsiveOverlay defaultOpen={startOpen} responsive={responsive}>
      <ResponsiveOverlayTrigger>打开自适应浮层</ResponsiveOverlayTrigger>
      <ResponsiveOverlayContent
        title="编辑菜单"
        description="桌面端是锚定浮层，紧凑视口下换成底部 Drawer。"
        popover={{ side, align }}
      >
        <Items />
      </ResponsiveOverlayContent>
    </ResponsiveOverlay>
  );
}

/**
 * 照着 iOS 27 Edit Menu 的**结构**摆一遍，只为 Fidelity 对照图用。
 *
 * ⚠️ 面板（宽度、内边距、圆角、材质）是**真的 Popover 组件**；
 *    里面的 Quick Actions 行、菜单项、分隔线是**对照台自己画的** ——
 *    DropdownMenu 还没做（下一批）。所以那几部分只能算「按实测数值摆的占位」，
 *    不是被测组件。图注里写明了这一点。
 *
 * 数值全部来自 apple-metrics §7.7：
 *   Quick Actions 56 高，3 项各 72.67，间距 6
 *   分隔区 21 高，其中 1pt 线在区顶 +2，左右各内缩 8（面板内共 24）
 *   菜单项 40 高（带副标题的 60）
 * 加起来正好 10 + 56 + 262 + 10 = 338，与参考图逐位对齐。
 */
function MenuScene() {
  const label = { fontSize: 17, color: 'var(--lg-label-primary)' } as const;
  const Sep = () => (
    <div style={{ height: 21, position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: 8,
          right: 8,
          height: 1,
          background: 'var(--lg-separator)',
        }}
      />
    </div>
  );
  const Item = ({ text, h = 40 }: { text: string; h?: number }) => (
    <div style={{ height: h, display: 'flex', alignItems: 'center', ...label }}>{text}</div>
  );
  return (
    <Popover defaultOpen>
      <PopoverTrigger>打开菜单</PopoverTrigger>
      <PopoverContent side="bottom" align="start" aria-label="编辑菜单">
        <div style={{ height: 56, display: 'flex', gap: 6 }}>
          {['Cut', 'Copy', 'Paste'].map((t) => (
            <div
              key={t}
              style={{
                width: 72.67,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingBottom: 6,
                fontSize: 13,
                color: 'var(--lg-label-primary)',
              }}
            >
              {t}
            </div>
          ))}
        </div>
        <Sep />
        <Item text="Paste and Match Style" h={60} />
        <Item text="Add Link" />
        <Sep />
        <Item text="Replace…" />
        <Item text="Writing Tools" />
        <Item text="AutoFill" />
      </PopoverContent>
    </Popover>
  );
}

function Demo() {
  if (only === 'menu') return <MenuScene />;
  if (only === 'popover') return <PopoverDemo />;
  if (only === 'responsive') return <ResponsiveDemo />;
  return (
    <div className="flex flex-col gap-6">
      <PopoverDemo />
      <ResponsiveDemo />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <GlassProvider defaultTheme={theme} defaultTint={tint} tier={tier}>
    <Demo />
  </GlassProvider>,
);

queueMicrotask(() => {
  (window as unknown as { __ready?: boolean }).__ready = true;
});
