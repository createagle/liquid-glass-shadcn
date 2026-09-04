'use client';

// APPLE REFERENCE: NSSplitView / UISplitViewController —— **但没有可用的规格。**
//
// macOS 27 资源里确实有一个 `Split View`（节点 4361:10562，Dialogs 页），
// 但它是**一张对话框布局稿**：左栏 210 宽、右栏 790 宽，两栏直接挨着，
// **中间没有任何分隔条元素**，更没有拖拽把手。
//
// 也就是说：
//
//   分栏这件事本身      有参照（侧栏 210 宽是实测的）
//   **分隔条 / 把手**   **一条依据都没有** —— 全部 `[推定]`
//
// 与 Breadcrumb 同一档：数字全是借来的，并写明借自哪里。
//
//   分隔条命中宽 8      `[推定]` —— 取 HIG 44 的一个可用下限，见下
//   分隔线 1px          `[推定]` —— 与本库 Separator 同源（那边是实测）
//   把手 20 × 3         `[推定]` —— 比照 Sheet 的抓手（58 × 4，实测）缩小
//
// ── 一处不得不违反 HIG 的地方，写清楚 ────────────────────────────────
//
//   HIG 的最小触控目标是 44 × 44pt。分隔条**做不到** ——
//   一条 44pt 宽的分隔条会吃掉两侧内容的空间，而它在视觉上只有 1px。
//   本库的做法与 Apple 一致：**命中区 8pt，靠指针形状提示可拖**
//   （`cursor: col-resize`），并且**始终提供键盘路径**
//   （分隔条可聚焦，方向键调整，这是 react-resizable-panels 提供的）。
//
//   触屏上 8pt 确实不好拖 —— 所以**布局不应该依赖用户去拖它**。
//   这一条写进 registry 的 docs 字段了。
//
// ⚠️ 分层：清单第 44 行写「内容层（分隔条可用弱 B）」。
//   本库**不给分隔条上玻璃**：它只有 1px 宽，任何模糊都看不出来，
//   徒增一个折射实例（§5.2 的预算只有 8 个）。理由与 Badge 那次相同。

import * as React from 'react';
/*
 * ⚠️ react-resizable-panels **v4 改了导出名**：
 *   PanelGroup        → Group
 *   PanelResizeHandle → Separator
 *   direction         → orientation（值不变：horizontal / vertical）
 * shadcn 官方那份 resizable.tsx 还是 v3 的写法，照抄会直接编译不过。
 */
import { Group, Panel, Separator } from 'react-resizable-panels';

/*
 * ⚠️⚠️ **v4 会覆盖调用方传的 `data-testid`。**
 *
 * 它内部用 `data-testid={id}` 标记自己生成的 id（`_r_0_` 这种），
 * 而且写在展开之后 —— 你传的 `data-testid="rz-group"` 会被静默冲掉。
 * 实测：传进去 `rz-group`，DOM 上是 `data-testid="_r_0_"`。
 *
 * 这与本仓库踩过五次的 `data-slot` 覆盖是同一家族，只是这次覆盖方是上游。
 * **所以本组件的测试与样式一律靠 `data-slot` 选中**，不要用 data-testid。
 */
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 分隔条的命中宽（px）。`[推定]` —— 见文件头那条 HIG 说明 */
  handleHit: 8,
  /** 分隔线宽（px）。`[推定]` —— 与 Separator 同源 */
  lineWidth: 1,
  /** 把手长边（px）。`[推定]` —— 比照 Sheet 抓手缩小 */
  gripLength: 20,
  /** 把手短边（px）。`[推定]` */
  gripThickness: 3,
} as const;

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof Group>) {
  return (
    <Group
      className={cn(
        'flex h-full w-full',
        // v4 不再输出 data-panel-group-direction；方向靠 aria-orientation 反映
        'aria-[orientation=vertical]:flex-col',
        className,
      )}
      {...props}
      data-slot="resizable-panel-group"
    />
  );
}

function ResizablePanel(props: React.ComponentProps<typeof Panel>) {
  return <Panel {...props} data-slot="resizable-panel" />;
}

export interface GlassResizableHandleProps
  extends React.ComponentProps<typeof Separator> {
  /** 画一个可见的把手（那种小横条）。默认 `false` —— macOS 的分隔条是光的。 */
  withGrip?: boolean;
}

/**
 * 分隔条。
 *
 * ⚠️ 命中区 8pt，**够不到 HIG 的 44** —— 理由与代偿措施见文件头。
 * 它是可聚焦的，方向键能调整，键盘路径始终存在。
 */
function ResizableHandle({ className, withGrip = false, style, ...props }: GlassResizableHandleProps) {
  return (
    <Separator
      className={cn(
        'relative flex items-center justify-center',
        // 分隔线本体：横向组里是竖线，竖向组里是横线
        'bg-[var(--lg-separator)]',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-(--lg-handle-hit) after:-translate-x-1/2 after:content-[""]',
        /*
         * ⚠️ 竖向组里分隔条是**横**的，命中区要横过来。
         * v3 靠 `data-panel-group-direction`，v4 不再输出它 ——
         * 改读 `aria-orientation`（Separator 自己会写）。
         * 注意语义是反的：`aria-orientation=horizontal` 的分隔条
         * 出现在**竖向排列**的组里。
         */
        'aria-[orientation=horizontal]:after:inset-x-0',
        'aria-[orientation=horizontal]:after:left-0',
        'aria-[orientation=horizontal]:after:h-(--lg-handle-hit)',
        'aria-[orientation=horizontal]:after:w-full',
        'aria-[orientation=horizontal]:after:translate-x-0',
        'aria-[orientation=horizontal]:after:-translate-y-1/2',
        'aria-[orientation=horizontal]:after:top-1/2',
        'outline-none focus-visible:[box-shadow:0_0_0_3.5px_var(--lg-ring)]',
        className,
      )}
      style={{
        flex: `0 0 ${GEOMETRY.lineWidth}px`,
        ['--lg-handle-hit' as string]: `${GEOMETRY.handleHit}px`,
        ...style,
      }}
      {...props}
      data-slot="resizable-handle"
    >
      {withGrip ? (
        <span
          aria-hidden="true"
          data-slot="resizable-grip"
          /*
           * ⚠️ **绝对定位**，不能留在流里。
           * 分隔条是个 flex 项且 `flex-basis: 1px`，但 flex 项的
           * `min-width` 默认是 `auto` —— 留在流里的 3px 把手会把
           * 最小内容宽顶到 3，分隔线就从 1px 变成 3px（实测过）。
           */
          className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--lg-grabber-fill)]"
          style={{ width: GEOMETRY.gripThickness, height: GEOMETRY.gripLength }}
        />
      ) : null}
    </Separator>
  );
}

export {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  GEOMETRY as RESIZABLE_GEOMETRY,
};
