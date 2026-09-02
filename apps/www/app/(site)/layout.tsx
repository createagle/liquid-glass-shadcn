import { SiteHeader } from '@/components/site-header';

/** 带站点装饰的那一半。`/view/*` 刻意不在这个路由组里。 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1400px] px-3 pb-24">{children}</main>
    </>
  );
}
