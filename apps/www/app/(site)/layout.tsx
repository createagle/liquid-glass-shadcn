import { SiteHeader } from '@/components/site-header';
import { registryItems } from '@/lib/registry';

/**
 * 带站点装饰的那一半。`/view/*` 刻意不在这个路由组里。
 *
 * ⌘K 的索引在**服务端**拼好再传下去 —— 它就是 registry.json 加几条固定路由，
 * 没必要让每个访客的浏览器再算一遍，也不用把整份 registry 送到客户端。
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const commands = [
    { href: '/', title: '首页', group: '站点', keywords: 'home 首页' },
    { href: '/docs', title: '介绍', group: '文档', keywords: 'introduction 介绍 分层 layer' },
    { href: '/docs/installation', title: '安装', group: '文档', keywords: 'install 安装 cli shadcn' },
    {
      href: '/docs/materials',
      title: 'Materials',
      group: '原理',
      keywords: 'materials 材质 分层 layer b i 挖洞 punch alpha 可读性 legibility',
    },
    {
      href: '/docs/optics',
      title: 'Optics',
      group: '原理',
      keywords: 'optics 光学 折射 refraction 色散 dispersion tier 降级 degradation',
    },
    ...registryItems.map((i) => ({
      href: `/docs/components/${i.name}`,
      title: i.title,
      group: '组件',
      keywords: `${i.name} ${i.description}`,
    })),
  ];

  return (
    <>
      <SiteHeader commands={commands} />
      <main className="mx-auto w-full max-w-[1400px] px-3 pb-24">{children}</main>
    </>
  );
}
