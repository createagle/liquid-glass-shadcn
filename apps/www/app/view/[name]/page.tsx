import { notFound } from 'next/navigation';
import { ViewFrame } from '@/components/view-frame';
import { EDITORIAL } from '@/lib/registry';

/**
 * 独立全屏预览路由 —— PROJECT_SPEC §12：「每个 demo 支持独立全屏预览路由
 * （`/view/[name]`，便于截图和 iframe 嵌入）」。
 *
 * 这条路由**不套顶栏与侧栏**（见同目录的 layout.tsx），页面上只有示例本身。
 * 截图脚本与 iframe 都直接吃它。
 */

export function generateStaticParams() {
  return Object.values(EDITORIAL)
    .flatMap((e) => e.examples)
    .map((name) => ({ name }));
}

export default async function ViewPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const known = Object.values(EDITORIAL).some((e) => e.examples.includes(name));
  if (!known) notFound();
  return <ViewFrame name={name} />;
}
