/**
 * Button 渲染验证台（不是文档站 —— 文档站是 Phase 6）。
 */
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@glass/core';
import { Button, type GlassButtonVariant, type GlassButtonSize } from '../registry/glass/ui/button';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
/** 只渲染一行，视觉快照才不会被别的行牵连 */
const only = params.get('only') as GlassButtonVariant | null;

const VARIANTS: GlassButtonVariant[] = ['glass', 'prominent', 'destructive', 'plain'];
const SIZES: GlassButtonSize[] = ['sm', 'default', 'lg'];

function Row({ variant }: { variant: GlassButtonVariant }) {
  return (
    <div className="flex items-center gap-3" data-testid={`row-${variant}`}>
      {SIZES.map((size) => (
        <Button key={size} variant={variant} size={size}>
          Button
        </Button>
      ))}
      <Button variant={variant} size="icon" aria-label="图标按钮">
        {/* 简单的加号，避免引入图标库 */}
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M10 4v12M4 10h12" strokeLinecap="round" />
        </svg>
      </Button>
      <Button variant={variant} disabled>
        Disabled
      </Button>
    </div>
  );
}

function Demo() {
  const rows = only ? [only] : VARIANTS;
  return (
    <div className="flex flex-col gap-4">
      {rows.map((v) => (
        <Row key={v} variant={v} />
      ))}
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
