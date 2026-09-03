/**
 * Phase 7 第二批的渲染验证台：Progress / Badge / Separator / Skeleton / Avatar。
 *
 * 这一批的共同点是「**只有 Progress 该有玻璃**」——
 * 验证台把五个放在一起，就是为了让「哪些是内容层」一眼可查、也可断言。
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@glass/core';
import { Progress } from '../registry/glass/ui/progress';
import { Badge } from '../registry/glass/ui/badge';
import { Separator } from '../registry/glass/ui/separator';
import { Skeleton } from '../registry/glass/ui/skeleton';
import { Avatar } from '../registry/glass/ui/avatar';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
const only = params.get('only');

function ProgressRow() {
  return (
    <div data-testid="row-progress" className="flex flex-col gap-3" style={{ width: 250 }}>
      <Progress value={0} aria-label="p0" />
      <Progress value={38} aria-label="p38" />
      <Progress value={100} aria-label="p100" />
      <Progress aria-label="indeterminate" />
      {/* 越界的值必须被夹住，不能画出轨道 */}
      <Progress value={140} aria-label="overflow" />
    </div>
  );
}

function BadgeRow() {
  return (
    <div data-testid="row-badge" className="flex flex-wrap items-center gap-2">
      <Badge variant="count">3</Badge>
      <Badge variant="neutral">草稿</Badge>
      <Badge variant="accent">新</Badge>
      <Badge variant="outline">已归档</Badge>
    </div>
  );
}

function SeparatorRow() {
  return (
    <div data-testid="row-separator" className="flex flex-col gap-3" style={{ width: 250 }}>
      <span>上</span>
      <Separator />
      <span>下</span>
      <Separator decorative={false} data-testid="semantic-sep" />
      <div className="flex h-5 items-center gap-3">
        <span>左</span>
        <Separator orientation="vertical" data-testid="vertical-sep" />
        <span>右</span>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div data-testid="row-skeleton" aria-busy="true" className="flex gap-3" style={{ width: 250 }}>
      <Skeleton style={{ width: 40, height: 40, borderRadius: '50%' }} />
      <div className="flex flex-1 flex-col justify-center gap-2">
        <Skeleton style={{ height: 12, width: '70%' }} />
        <Skeleton style={{ height: 12, width: '45%' }} />
      </div>
    </div>
  );
}

/** 一张一定能加载成功的内联图，避免验证台依赖网络 */
const OK_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='%23ff2d55'/%3E%3C/svg%3E";

function AvatarRow() {
  // 换 src 之后「加载失败」必须被清掉 —— 否则第一张失败会让后面所有图都出不来
  const [src, setSrc] = React.useState<string | undefined>('/definitely-not-here.png');
  return (
    <div data-testid="row-avatar" className="flex items-center gap-3">
      <Avatar src={OK_SRC} alt="有图" />
      <Avatar src={src} alt="会挂的图" fallback="WD" />
      <Avatar alt="没有图" fallback="LG" />
      {/* 既没 alt 也没 fallback —— 应当整个对辅助技术隐藏 */}
      <Avatar data-testid="anonymous-avatar" />
      <button type="button" data-testid="fix-src" onClick={() => setSrc(OK_SRC)}>
        换成好图
      </button>
      <button type="button" data-testid="break-src" onClick={() => setSrc('/nope.png')}>
        换成坏图
      </button>
    </div>
  );
}

function Demo() {
  if (only === 'progress') return <ProgressRow />;
  if (only === 'badge') return <BadgeRow />;
  if (only === 'separator') return <SeparatorRow />;
  if (only === 'skeleton') return <SkeletonRow />;
  if (only === 'avatar') return <AvatarRow />;
  return (
    <div className="flex flex-col gap-6">
      <ProgressRow />
      <BadgeRow />
      <SeparatorRow />
      <SkeletonRow />
      <AvatarRow />
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
