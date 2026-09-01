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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../registry/glass/ui/dropdown-menu';

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
 * DropdownMenu 验证台 + Fidelity 对照场景。
 *
 * 结构照着 iOS 27 Edit Menu 摆（apple-metrics §7.7）：
 *   Quick Actions 56 高（3 项各 72.67、间距 6）· 分隔区 21 · 项 40（双行 60）
 * 加起来正好 10 + 56 + 262 + 10 = 338，与参考图逐位对齐。
 *
 * ⚠️ **Quick Actions 那一行仍然是对照台自己画的** —— Apple 的菜单顶部有一种
 *    「图标三连」的特殊行，本库没有对应组件（也不在 P0 清单里）。
 *    其余部分（面板、菜单项、分隔线、高亮项）**全是真组件**。
 */
function MenuScene() {
  return (
    <DropdownMenu defaultOpen={startOpen} responsive={responsive}>
      <DropdownMenuTrigger>打开菜单</DropdownMenuTrigger>
      <DropdownMenuContent title="编辑菜单" side={side} align={align}>
        {/* 对照台自己画的占位行，不是被测组件 */}
        <div data-testid="quick-actions" style={{ height: 56, display: 'flex', gap: 6 }}>
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
        <DropdownMenuSeparator />
        <DropdownMenuItem>Paste and Match Style</DropdownMenuItem>
        <DropdownMenuItem>Add Link</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Replace…</DropdownMenuItem>
        <DropdownMenuItem>Writing Tools</DropdownMenuItem>
        <DropdownMenuItem>AutoFill</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 带标题、禁用项、破坏性项的完整菜单 —— 行为测试用这个 */
function DropdownDemo() {
  return (
    <DropdownMenu defaultOpen={startOpen} responsive={responsive}>
      <DropdownMenuTrigger>打开菜单</DropdownMenuTrigger>
      <DropdownMenuContent title="编辑菜单" side={side} align={align}>
        <DropdownMenuLabel>编辑</DropdownMenuLabel>
        <DropdownMenuItem>Cut</DropdownMenuItem>
        <DropdownMenuItem>Copy</DropdownMenuItem>
        <DropdownMenuItem disabled>Paste</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Demo() {
  if (only === 'menu') return <MenuScene />;
  if (only === 'dropdown') return <DropdownDemo />;
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
