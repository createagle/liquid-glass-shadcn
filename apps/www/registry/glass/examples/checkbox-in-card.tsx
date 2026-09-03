'use client';

import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardRow } from '@/components/ui/card';

/**
 * **这一屏里一块玻璃都没有 —— 而它是对的。**
 *
 * 两件事叠在一起：
 *   · Checkbox 是内容层 —— macOS 27 资源的 36 个变体里没有任何
 *     模糊 / 折射 / 色散（apple-metrics.md §10.3）；
 *   · `Card` 默认的 `grouped` 变体也不是玻璃 —— 它是 iOS 分组列表那一块
 *     **完全不透明的白**（区块底色实测 alpha=255）。
 *
 * 所以整个组合的 `.lg-surface` 计数是 **0**，验证台里有断言钉着它。
 * 这就是 iOS 表单本来的样子：材质留给浮在内容之上的东西
 * （Tabs 指示器、Sheet 抓手 —— 它们底下有滚动的内容，折射才有东西可折），
 * 而不是撒在每一个控件上。
 *
 * 还有一条工程理由：一组复选框有十几个是常态。
 * 若每个都自带折射，一屏就撞穿 PROJECT_SPEC §5.2 的 8 个实例预算。
 */
export default function CheckboxInCard() {
  const [on, setOn] = React.useState([true, false, true]);
  const set = (i: number, v: boolean) =>
    setOn((prev) => prev.map((p, j) => (i === j ? v : p)));

  return (
    <Card className="w-[280px]">
      {['邮件通知', '推送通知', '短信通知'].map((label, i) => (
        <CardRow key={label}>
          <Checkbox checked={on[i] ?? false} onCheckedChange={(v) => set(i, v === true)}>
            {label}
          </Checkbox>
        </CardRow>
      ))}
    </Card>
  );
}
