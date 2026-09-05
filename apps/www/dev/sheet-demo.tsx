/**
 * Sheet / Drawer 渲染验证台（不是文档站 —— 文档站是 Phase 6）。
 *
 * `?open=1`        一进来就是打开的，测试不用先去点触发器
 * `?detent=1`      初始停在第二档（large）
 * `?dragfrom=sheet` 整片可拖，而不是只有抓手区与标题区
 * `?nograbber=1`   关掉抓手，验证「没有抓手时其余部分照常工作」
 */
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@createagle/glass-core';
import {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from '../registry/glass/ui/sheet';
import { Card, CardRow } from '../registry/glass/ui/card';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
const startOpen = params.get('open') === '1';
const defaultDetent = Number(params.get('detent') ?? '0');
const dragFrom = (params.get('dragfrom') ?? 'handle') as 'handle' | 'sheet';
const grabber = params.get('nograbber') !== '1';

function Demo() {
  return (
    <Sheet defaultOpen={startOpen}>
      {/* 触发器是 Radix 的原生 button —— 本库禁用 asChild，理由见组件注释 */}
      <SheetTrigger>打开面板</SheetTrigger>
      <SheetContent defaultDetent={defaultDetent} dragFrom={dragFrom} grabber={grabber}>
        <SheetHeader>
          <SheetTitle>Title</SheetTitle>
          <SheetDescription>从抓手或标题栏往下拖可以关闭。</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {/* 用 Card 填内容，顺便验证内容层组件塞进 sheet 里不会打架 */}
          <Card>
            <CardRow interactive>
              <span className="flex-1">Airplane Mode</span>
            </CardRow>
            <CardRow interactive>
              <span className="flex-1">Wi-Fi</span>
            </CardRow>
            <CardRow interactive>
              <span className="flex-1">Bluetooth</span>
            </CardRow>
          </Card>
        </SheetBody>
        <SheetFooter>
          <SheetClose variant="prominent" className="w-full">
            Done
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * 外壳上的 `data-glass-sheet-wrapper` 写在 sheet-demo.html 里
 * （sheet 走 portal 挂在 body 上，必须在外壳**之外**，否则会跟着一起缩）。
 */
createRoot(document.getElementById('root')!).render(
  <GlassProvider defaultTheme={theme} defaultTint={tint} tier={tier}>
    <Demo />
  </GlassProvider>,
);

queueMicrotask(() => {
  (window as unknown as { __ready?: boolean }).__ready = true;
});
