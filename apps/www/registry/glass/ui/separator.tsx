'use client';

// APPLE REFERENCE: UITableView separator / HIG "separators"
//
// 尺寸来源：Apple Design Resources《iOS and iPadOS 27》Figma 文件，
// 节点 12740:33850 / 12740:33923 的 Grouped List，记录见 apple-metrics.md §8.2、§8.3。
//
//   分隔线厚度   1 pt                   [实测]（三块列表、两种行类型一致）
//   分组列表内   两侧各内缩 16 pt        [实测]
//   分组列表色   #e6e6e6（压白底）       [实测]（= 黑 9.8%）
//
// ⚠️⚠️ **本库有两个不同的分隔线颜色，而且刻意不合并。**
//
//   `--lg-list-separator`  #e6e6e6  `[实测]`  —— 分组列表**行之间**那条
//   `--lg-separator`       黑 29%   `[待核实 · 社区通行值]` —— iOS 通用分隔线
//
//   压在白底上前者是 #e6e6e6、后者是 #c6c6c7，**后者明显深得多**。
//   同一份资源里两者就是不同的粗细，合并会把量到的事实抹掉（§8.2 已记）。
//
//   所以：**分组列表里的分隔线由 `<Card>` 自己画**（用实测的那个），
//   本组件用的是通用那个。两者不是一回事，别互相替代。
//
// 分层：**内容层，不套任何材质**。PROJECT_SPEC §2「材质属于控件层」——
// 一条 1px 的线上没有任何东西能承载折射或模糊，加玻璃纯粹是徒增一层合成。

import * as React from 'react';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 厚度（px）。[实测] 1pt */
  thickness: 1,
} as const;

export interface GlassSeparatorProps extends React.ComponentProps<'div'> {
  orientation?: 'horizontal' | 'vertical';
  /**
   * 纯装饰。默认 `true`。
   *
   * ⚠️ 默认值是刻意选的：绝大多数分隔线只是**视觉分组**，
   * 语义上并不分隔两段内容。给每条线都报 `role="separator"`
   * 会让屏幕阅读器一路念「分隔符、分隔符、分隔符」，是噪音不是信息。
   *
   * 只有当这条线**真的**划分了两个语义区块（比如菜单里的分组界线）
   * 才传 `decorative={false}`。
   */
  decorative?: boolean;
}

function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  style,
  ...props
}: GlassSeparatorProps) {
  const horizontal = orientation === 'horizontal';
  return (
    <div
      data-slot="separator"
      data-orientation={orientation}
      {...(decorative
        ? { role: 'none' }
        : { role: 'separator', 'aria-orientation': orientation })}
      className={cn('shrink-0', horizontal ? 'w-full' : 'self-stretch', className)}
      style={{
        [horizontal ? 'height' : 'width']: GEOMETRY.thickness,
        // 通用分隔线，不是分组列表那条 —— 见文件头的两色说明
        background: 'var(--lg-separator)',
        ...style,
      }}
      {...props}
    />
  );
}

export { Separator, GEOMETRY as SEPARATOR_GEOMETRY };
