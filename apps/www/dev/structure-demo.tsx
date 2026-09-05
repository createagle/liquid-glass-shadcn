/**
 * P2 第一批（Accordion / Collapsible / ScrollArea / Table）的渲染验证台。
 *
 * 四个**全是内容层**，所以与 toggles2 那台一样，
 * 「子树里 .lg-surface 计数为 0」本身就是要断言的事实 ——
 * 唯一的例外是 ScrollArea 打开边缘效果时，那一层是 core 的 GlassScrollEdge。
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { GlassProvider } from '@createagle/glass-core';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  DisclosureIndicator,
} from '../registry/glass/ui/collapsible';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../registry/glass/ui/accordion';
import { ScrollArea } from '../registry/glass/ui/scroll-area';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '../registry/glass/ui/table';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
const only = params.get('only');

function CollapsibleRow() {
  return (
    <div data-testid="row-collapsible" className="flex flex-col gap-4" style={{ width: 320 }}>
      <Collapsible defaultOpen data-testid="cl-open">
        <CollapsibleTrigger data-testid="cl-open-trigger">默认展开</CollapsibleTrigger>
        <CollapsibleContent>
          <p className="pt-2 pl-9 text-[15px] text-[var(--lg-label-secondary)]">
            这一段在展开时可见。
          </p>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible data-testid="cl-closed">
        <CollapsibleTrigger data-testid="cl-closed-trigger">默认收起</CollapsibleTrigger>
        <CollapsibleContent>
          <p className="pt-2 pl-9 text-[15px] text-[var(--lg-label-secondary)]">收起时不可见。</p>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible disabled>
        <CollapsibleTrigger data-testid="cl-disabled" disabled>
          禁用
        </CollapsibleTrigger>
        <CollapsibleContent>看不到</CollapsibleContent>
      </Collapsible>

      {/* 五档尺寸铺开 —— 圆角是查表不是比例，这一行就是给它做回归的 */}
      <div className="flex items-center gap-2" data-testid="cl-sizes">
        {[16, 20, 24, 28, 36].map((s) => (
          <DisclosureIndicator key={s} size={s} data-testid={`ind-${s}`} />
        ))}
      </div>
    </div>
  );
}

function AccordionRow() {
  return (
    <div data-testid="row-accordion" style={{ width: 320 }}>
      <Accordion type="single" collapsible defaultValue="a" data-testid="ac">
        <AccordionItem value="a">
          <AccordionTrigger data-testid="ac-a">通知</AccordionTrigger>
          <AccordionContent>允许这个 App 发送通知。</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger data-testid="ac-b">隐私</AccordionTrigger>
          <AccordionContent>控制它能读到哪些数据。</AccordionContent>
        </AccordionItem>
        <AccordionItem value="c">
          <AccordionTrigger data-testid="ac-c" disabled>
            订阅（禁用）
          </AccordionTrigger>
          <AccordionContent>看不到</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function ScrollRow() {
  return (
    <div data-testid="row-scroll" className="flex gap-6">
      <ScrollArea style={{ height: 160, width: 200 }} data-testid="sa-plain">
        <div className="flex flex-col gap-2 p-3 text-[15px]">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i}>第 {i + 1} 行</span>
          ))}
        </div>
      </ScrollArea>

      {/*
       * type="always" 的一份。
       *
       * ⚠️ 不是为了好看，是**可测性**：默认的 `scroll` 档在停止滚动后
       * 几百毫秒就把滚动条收走，量它会随机量到 null，
       * 视觉快照更是拍不到。滚动条的几何回归全靠这一格。
       */}
      <ScrollArea type="always" style={{ height: 160, width: 200 }} data-testid="sa-always">
        <div className="flex flex-col gap-2 p-3 text-[15px]">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i}>第 {i + 1} 行</span>
          ))}
        </div>
      </ScrollArea>

      {/* 打开边缘效果的那一份 —— 这一格里**应当**有一层 core 的玻璃 */}
      <ScrollArea edges style={{ height: 160, width: 200 }} data-testid="sa-edges">
        <div className="flex flex-col gap-2 p-3 text-[15px]">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i}>第 {i + 1} 行</span>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

const ROWS = [
  ['报告.pdf', '2.4 MB', '昨天'],
  ['照片', '—', '上周'],
  ['预算.xlsx', '18 KB', '3 月 2 日'],
  ['归档.zip', '104 MB', '去年'],
];

function TableRowsDemo({ density }: { density: 'default' | 'compact' }) {
  const [sel, setSel] = React.useState(1);
  return (
    <Table density={density} data-testid={`tbl-${density}`}>
      <TableCaption>四个文件</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead sorted="asc">名称</TableHead>
          <TableHead>大小</TableHead>
          <TableHead>修改时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map(([name, size, when], i) => (
          <TableRow
            key={name}
            selected={sel === i}
            level={i === 1 ? 1 : 0}
            tabIndex={0}
            onFocus={() => setSel(i)}
            data-testid={`tr-${i}`}
          >
            <TableCell>{name}</TableCell>
            <TableCell>{size}</TableCell>
            <TableCell>{when}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TableRowGroup() {
  return (
    <div data-testid="row-table" className="flex flex-col gap-6" style={{ width: 340 }}>
      <TableRowsDemo density="default" />
      <TableRowsDemo density="compact" />
    </div>
  );
}

function Demo() {
  if (only === 'collapsible') return <CollapsibleRow />;
  if (only === 'accordion') return <AccordionRow />;
  if (only === 'scroll') return <ScrollRow />;
  if (only === 'table') return <TableRowGroup />;
  return (
    <div className="flex flex-col gap-8">
      <CollapsibleRow />
      <AccordionRow />
      <ScrollRow />
      <TableRowGroup />
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
