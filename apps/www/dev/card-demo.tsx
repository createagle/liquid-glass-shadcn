/**
 * Card 渲染验证台（不是文档站 —— 文档站是 Phase 6）。
 *
 * `?only=reference` 渲染的是**照着 iOS 27 参考图的构图**：370 宽的分组区块、
 * 两行开关、页面底色 #f2f2f7。Fidelity 对照图就是拿它和
 * screenshots/ios27-grouped-list-rows.png 并排比 —— 两边尺寸一致才比得了。
 */
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@createagle/glass-core';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  CardRow,
  type GlassCardMaterial,
} from '../registry/glass/ui/card';
import { Switch } from '../registry/glass/ui/switch';
import { Button } from '../registry/glass/ui/button';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
const only = params.get('only');
const material = (params.get('material') ?? 'regular') as GlassCardMaterial;

/** 参考图的构图：分组区块 + 两行开关。宽度写死 370，与 iOS 27 实测一致。 */
function ReferenceList() {
  return (
    <div data-testid="row-reference" style={{ width: 370 }}>
      <Card>
        <CardRow>
          <span className="flex-1">Switch is on</span>
          <Switch defaultChecked aria-label="Switch is on" />
        </CardRow>
        <CardRow>
          <span className="flex-1">Switch is off</span>
          <Switch aria-label="Switch is off" />
        </CardRow>
      </Card>
    </div>
  );
}

/** 可点的行 —— iOS 分组列表里最常见的那种（跳转/选择） */
function InteractiveList() {
  return (
    <div data-testid="row-interactive" style={{ width: 370 }}>
      <Card>
        <CardRow interactive>
          <span className="flex-1">Airplane Mode</span>
        </CardRow>
        <CardRow interactive>
          <span className="flex-1">Wi-Fi</span>
          <span style={{ color: 'var(--lg-label-secondary)' }}>Not Connected</span>
        </CardRow>
        <CardRow interactive disabled>
          <span className="flex-1">Bluetooth</span>
        </CardRow>
      </Card>
    </div>
  );
}

/** 正文型卡片 —— shadcn 那套 Header / Content / Footer 的槽位 */
function ContentCard({ variant }: { variant: 'grouped' | 'material' | 'plain' }) {
  return (
    <div data-testid={`row-${variant}`} style={{ width: 370 }}>
      <Card variant={variant} material={material}>
        <CardHeader>
          <CardTitle>A Short Title Is Best</CardTitle>
          <CardDescription>A message should be a short, complete sentence.</CardDescription>
          <CardAction>
            <Button variant="plain" size="sm">
              Edit
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>正文区不堆玻璃 —— 材质属于控件层。</CardContent>
        <CardFooter>
          <Button variant="prominent" size="sm">
            Continue
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function Demo() {
  if (only === 'reference') return <ReferenceList />;
  if (only === 'interactive') return <InteractiveList />;
  if (only === 'grouped' || only === 'material' || only === 'plain') {
    return <ContentCard variant={only} />;
  }
  return (
    <div className="flex flex-col gap-6">
      <ReferenceList />
      <InteractiveList />
      <ContentCard variant="grouped" />
      <ContentCard variant="material" />
      <ContentCard variant="plain" />
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
