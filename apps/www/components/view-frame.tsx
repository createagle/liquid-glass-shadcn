'use client';

import { examples } from '@/__registry__/examples';

/**
 * `/view/[name]` 的渲染体：只有示例，没有任何站点装饰。
 *
 * `?bg=stripes` 换成 6px 黑白条纹 —— 全库的光学诊断都用它当高频最坏情况，
 * 折射与色散在平滑渐变上本来就看不出来。截图脚本会用到。
 */
export function ViewFrame({ name }: { name: string }) {
  const entry = examples[name];
  if (!entry) return null;
  const Demo = entry.component;
  return (
    <div
      data-view={name}
      className="flex min-h-screen w-full items-center justify-center p-8"
    >
      <Demo />
    </div>
  );
}
