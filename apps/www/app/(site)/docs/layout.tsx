import { SiteSidebar } from '@/components/site-sidebar';
import { registryItems } from '@/lib/registry';

/**
 * 文档区的两栏布局。左侧导航是本库的 Card / CardRow（iOS 分组列表）。
 *
 * 组件清单**从 registry.json 读**，不手写 —— 加了 registry item 就自动出现在
 * 导航里，不会出现「组件发了但文档站没有入口」。
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const groups = [
    {
      title: '开始',
      items: [
        { href: '/docs', label: '介绍' },
        { href: '/docs/installation', label: '安装' },
      ],
    },
    {
      title: '组件',
      items: registryItems.map((i) => ({
        href: `/docs/components/${i.name}`,
        label: i.title,
      })),
    },
  ];

  return (
    <div className="flex flex-col gap-8 pt-8 lg:flex-row lg:items-start lg:gap-10">
      <aside className="w-full shrink-0 lg:sticky lg:top-28 lg:w-[248px]">
        <SiteSidebar groups={groups} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
