/**
 * Tabs 渲染验证台（不是文档站 —— 文档站是 Phase 6）。
 *
 * 用途：让 Playwright 能真实渲染组件，做像素判定、Fidelity 对照图、
 * 以及 PROJECT_SPEC §14 里那些「必须看得见才算数」的验收项。
 */
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@createagle/glass-core';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../registry/glass/ui/tabs';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');

function Demo() {
  return (
    <Tabs defaultValue="library" data-testid="tabs">
      <TabsList aria-label="示例分段控件">
        <TabsTrigger value="library">资料库</TabsTrigger>
        <TabsTrigger value="radio">广播</TabsTrigger>
        <TabsTrigger value="search">搜索</TabsTrigger>
      </TabsList>
      <TabsContent value="library">资料库内容</TabsContent>
      <TabsContent value="radio">广播内容</TabsContent>
      <TabsContent value="search">搜索内容</TabsContent>
    </Tabs>
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
