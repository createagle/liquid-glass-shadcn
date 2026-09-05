/**
 * Phase 7 第三批的渲染验证台：Tooltip / Toast / InputGroup。
 *
 * 三个的共同点是**都没有 Apple 参考图**（Tooltip 只有一句 HIG 原文，
 * Toast 连对应物都没有，InputGroup 只有一个清除按钮的样例）。
 * 所以这个验证台主要验的是**行为与无障碍语义**，不是像素还原度。
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@createagle/glass-core';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../registry/glass/ui/tooltip';
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  Toaster,
  toast,
} from '../registry/glass/ui/toast';
import { InputGroup, InputGroupAddon } from '../registry/glass/ui/input-group';
import { Input } from '../registry/glass/ui/input';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
const only = params.get('only');

function TooltipRow() {
  return (
    <TooltipProvider delayDuration={0}>
      <div data-testid="row-tooltip" className="flex items-center gap-4">
        <Tooltip>
          <TooltipTrigger
            aria-label="复制"
            className="h-11 w-11 bg-[var(--lg-fill-secondary)] text-[17px]"
          >
            ⧉
          </TooltipTrigger>
          <TooltipContent>复制到剪贴板</TooltipContent>
        </Tooltip>
        {/* 默认打开的一个 —— 视觉回归要拍到气泡本体 */}
        <Tooltip open>
          <TooltipTrigger
            aria-label="总是打开"
            className="h-11 w-11 bg-[var(--lg-fill-secondary)] text-[17px]"
          >
            ★
          </TooltipTrigger>
          <TooltipContent side="bottom">这一个是常开的</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

/** 声明式的 Toast —— 视觉回归拍这个（命令式的那条要点一下才出来） */
function ToastRow() {
  return (
    <div data-testid="row-toast" style={{ width: 370 }}>
      <ToastProvider duration={1000000}>
        <Toast open data-testid="static-toast">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <ToastTitle>已保存</ToastTitle>
            <ToastDescription>改动会同步到所有设备。</ToastDescription>
          </div>
          <ToastAction altText="在设置里重试同步">重试</ToastAction>
          <ToastClose />
        </Toast>
        <Toast open variant="destructive" data-testid="static-toast-destructive">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <ToastTitle>同步失败</ToastTitle>
            <ToastDescription>检查网络后重试。</ToastDescription>
          </div>
          <ToastClose />
        </Toast>
        {/*
          ⚠️ 视觉回归里 viewport 必须**不是 fixed** —— 固定定位的元素不在
          [data-testid^="row-"] 的盒子里，截图会拍到一片空白。
          这里就地渲染，位置行为另有断言覆盖。
        */}
        <ToastViewport style={{ position: 'static', maxWidth: 370, marginInline: 0 }} />
      </ToastProvider>
    </div>
  );
}

/** 命令式队列 —— 行为测试用 */
function ToastQueueRow() {
  const n = React.useRef(0);
  return (
    <div data-testid="row-toast-queue" className="flex items-center gap-3">
      <button
        type="button"
        data-testid="push-toast"
        onClick={() => {
          n.current += 1;
          toast({ title: `第 ${n.current} 条`, description: '排队看看' });
        }}
      >
        再来一条
      </button>
      <Toaster limit={2} />
    </div>
  );
}

function InputGroupRow() {
  const [shown, setShown] = React.useState(false);
  return (
    <div data-testid="row-input-group" className="flex flex-col gap-3" style={{ width: 370 }}>
      <InputGroup>
        <InputGroupAddon>￥</InputGroupAddon>
        <Input variant="list" placeholder="0.00" aria-label="金额" />
        <InputGroupAddon>CNY</InputGroupAddon>
      </InputGroup>

      <InputGroup>
        <Input
          variant="list"
          type={shown ? 'text' : 'password'}
          defaultValue="liquid-glass"
          aria-label="密码"
        />
        <InputGroupAddon
          interactive
          aria-pressed={shown}
          aria-label={shown ? '隐藏密码' : '显示密码'}
          data-testid="toggle-password"
          onClick={() => setShown((v) => !v)}
        >
          {shown ? '隐' : '显'}
        </InputGroupAddon>
      </InputGroup>

      <InputGroup invalid>
        <Input variant="list" defaultValue="错的" aria-label="校验失败" aria-invalid />
      </InputGroup>
    </div>
  );
}

function Demo() {
  if (only === 'tooltip') return <TooltipRow />;
  if (only === 'toast') return <ToastRow />;
  if (only === 'toast-queue') return <ToastQueueRow />;
  if (only === 'input-group') return <InputGroupRow />;
  return (
    <div className="flex flex-col gap-8">
      <TooltipRow />
      <ToastRow />
      <ToastQueueRow />
      <InputGroupRow />
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
