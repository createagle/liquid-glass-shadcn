'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

/**
 * 三个变体，**没有一个是玻璃**。
 *
 * PROJECT_SPEC §15 #9：内容型组件不堆玻璃 —— 材质属于控件层。
 * `grouped` 是不透明的分组列表底；`material` 用 Apple 的四档内容材质
 * （不是 Layer B 玻璃）；`plain` 干脆没有底，也因此**不提供可读性地板**。
 */
export default function CardVariants() {
  return (
    <div className="grid w-full max-w-[560px] gap-4 sm:grid-cols-3">
      {(['grouped', 'material', 'plain'] as const).map((v) => (
        <Card key={v} variant={v}>
          <CardHeader>
            <CardTitle>{v}</CardTitle>
            <CardDescription>
              {v === 'grouped' ? '不透明' : v === 'material' ? '内容层材质' : '无底'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-[13px]">压在花哨背景上看差别最明显。</CardContent>
        </Card>
      ))}
    </div>
  );
}
