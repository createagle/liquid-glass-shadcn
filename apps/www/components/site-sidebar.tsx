'use client';

/**
 * 组件侧边导航。用本库的 `Card` + `CardRow` 搭 ——
 * 那正是 iOS 的分组列表，也是 SPEC §12「站点必须用本库组件」的第二处落实。
 *
 * ⚠️ `CardRow` 必须是 `Card` 的**直接子元素**（区块的竖直内边距靠
 * `:has(> [data-slot=card-row])` 去掉），所以链接包在行**里面**，
 * 不能反过来把行包进链接里。
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card, CardRow } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface SidebarItem {
  href: string;
  label: string;
}

export function SiteSidebar({ groups }: { groups: { title: string; items: SidebarItem[] }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-6" aria-label="文档导航">
      {groups.map((g) => (
        <div key={g.title} className="flex flex-col gap-2">
          {/* iOS 26+ 的 section header 不再全大写（HIG，见 apple-metrics §8.1） */}
          <h2 className="px-4 text-[15px] font-semibold text-[var(--lg-label-secondary)]">
            {g.title}
          </h2>
          <Card>
            {g.items.map((it) => {
              const active = pathname === it.href;
              return (
                <CardRow key={it.href} data-active={active ? 'true' : undefined}>
                  <Link
                    href={it.href as never}
                    className={cn(
                      'flex-1 py-1 outline-none focus-visible:underline',
                      active
                        ? 'font-medium text-[var(--lg-label-primary)]'
                        : 'text-[var(--lg-label-secondary)]',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {it.label}
                  </Link>
                  {active ? (
                    <span aria-hidden="true" className="text-[var(--lg-label-tertiary)]">
                      ‹
                    </span>
                  ) : null}
                </CardRow>
              );
            })}
          </Card>
        </div>
      ))}
    </nav>
  );
}
