/**
 * P2 第三批（Sidebar / Menubar / Navigation Menu）的渲染验证台。
 *
 * 这一批的看点集中在**材质**上，不在几何：
 *   Sidebar          全库唯一一块 `scale="large"` 的玻璃（实测 0.92）
 *   Menubar          ❗**条本身没有材质** —— 实测推翻了清单的「B + I」
 *   NavigationMenu   Apple 没有这个控件，几何全部借来
 *
 * ⚠️ 背景一律用渐变而不是分组底色 —— 侧栏的全部看点是「它比控件层更不透明」，
 *    压在纯色上根本看不出来，快照也就守不住材质。
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { GlassProvider, GlassSurface } from '@glass/core';
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarItem,
} from '../registry/glass/ui/sidebar';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
} from '../registry/glass/ui/menubar';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from '../registry/glass/ui/navigation-menu';

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'light') as 'light' | 'dark';
const tier = (params.get('tier') ?? 'a') as 'a' | 'b' | 'c';
const tint = Number(params.get('tint') ?? '0.34');
const only = params.get('only');

function SidebarRow() {
  const [sel, setSel] = React.useState('inbox');
  return (
    <div data-testid="row-sidebar">
      <SidebarProvider className="h-[380px] w-[520px] gap-3 overflow-hidden">
        <Sidebar label="邮箱导航" width={260}>
          <SidebarHeader>
            <SidebarTrigger data-testid="sb-trigger" />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel data-testid="sb-group-label">本机</SidebarGroupLabel>
              <SidebarItem
                data-testid="sb-inbox"
                selected={sel === 'inbox'}
                detail="12"
                onClick={() => setSel('inbox')}
              >
                收件箱
              </SidebarItem>
              <SidebarItem
                data-testid="sb-sent"
                selected={sel === 'sent'}
                onClick={() => setSel('sent')}
              >
                已发送
              </SidebarItem>
              <SidebarItem data-testid="sb-l1" level={1}>
                子项一级
              </SidebarItem>
              <SidebarItem data-testid="sb-l2" level={2}>
                子项二级
              </SidebarItem>
              <SidebarItem data-testid="sb-disabled" disabled>
                不可用
              </SidebarItem>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <div className="min-w-0 flex-1 p-3 text-[13px]">正文区</div>
      </SidebarProvider>
    </div>
  );
}

/** 材质对照：同一块背景上，控件层玻璃 vs 侧栏玻璃。 */
function ScaleRow() {
  return (
    <div data-testid="row-scale" className="flex items-center gap-4">
      <GlassSurface
        layer="base"
        radius={22}
        continuous
        data-testid="scale-control"
        style={{ width: 150, height: 90 }}
      />
      <GlassSurface
        layer="base"
        scale="large"
        radius={22}
        continuous
        data-testid="scale-large"
        style={{ width: 150, height: 90 }}
      />
    </div>
  );
}

function MenubarRow() {
  return (
    <div data-testid="row-menubar" className="flex flex-col items-start gap-4">
      <Menubar data-testid="mb-plain">
        <MenubarMenu>
          <MenubarTrigger app data-testid="mb-app">
            示例
          </MenubarTrigger>
          <MenubarContent data-testid="mb-app-content">
            <MenubarItem data-testid="mb-about">关于本 App</MenubarItem>
            <MenubarSeparator />
            <MenubarItem shortcut="⌘Q" destructive>
              退出
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger data-testid="mb-file">文件</MenubarTrigger>
          <MenubarContent>
            <MenubarItem shortcut="⌘N">新建</MenubarItem>
            <MenubarItem disabled>恢复到…</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      <Menubar surface data-testid="mb-surface">
        <MenubarMenu>
          <MenubarTrigger app>示例</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>关于本 App</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}

function NavRow() {
  return (
    <div data-testid="row-navigation-menu">
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem value="a">
            <NavigationMenuTrigger data-testid="nm-trigger-a">组件</NavigationMenuTrigger>
            <NavigationMenuContent data-testid="nm-content-a">
              <div className="flex w-[240px] flex-col gap-1">
                <NavigationMenuLink href="#sidebar" data-testid="nm-link">
                  Sidebar
                </NavigationMenuLink>
                <NavigationMenuLink href="#menubar">Menubar</NavigationMenuLink>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem value="b">
            <NavigationMenuTrigger data-testid="nm-trigger-b">资源</NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="flex w-[200px] flex-col gap-1">
                <NavigationMenuLink href="#metrics">度量表</NavigationMenuLink>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}

const ROWS: Record<string, React.ReactNode> = {
  sidebar: <SidebarRow />,
  scale: <ScaleRow />,
  menubar: <MenubarRow />,
  'navigation-menu': <NavRow />,
};

function Demo() {
  const rows = only ? [only] : Object.keys(ROWS);
  return (
    <div className="flex flex-col gap-8">
      {rows.map((k) => (
        <React.Fragment key={k}>{ROWS[k]}</React.Fragment>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <GlassProvider defaultTheme={theme} defaultTint={tint} tier={tier}>
    <Demo />
  </GlassProvider>,
);

queueMicrotask(() => {
  (window as unknown as { __ready?: boolean }).__ready = true;
});
