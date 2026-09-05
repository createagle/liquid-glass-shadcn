/**
 * Dialog 渲染验证台（不是文档站 —— 文档站是 Phase 6）。
 *
 * `?open=1` 让弹窗一进来就是打开的，测试不用先去点触发器 ——
 * 也省得每次都要等一遍入场动画。
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@createagle/glass-core';
import {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../registry/glass/ui/dialog';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
const startOpen = params.get('open') === '1';

function Demo() {
  return (
    <Dialog defaultOpen={startOpen}>
      {/* 触发器是 Radix 的原生 button —— 本库禁用 asChild，理由见组件注释 */}
      <DialogTrigger>打开弹窗</DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>A Short Title Is Best</DialogTitle>
          <DialogDescription>
            A message should be a short, complete sentence.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose variant="glass">Cancel</DialogClose>
          <DialogClose variant="prominent">Default</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
