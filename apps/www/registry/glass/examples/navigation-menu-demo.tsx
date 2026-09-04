'use client';

import * as React from 'react';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from '@/components/ui/navigation-menu';

/**
 * ⚠️ **Apple 平台上不存在这个控件。**
 *
 * 两份官方资源（iOS/iPadOS 27 与 macOS 27）都查过，横排触发器 + 大内容面板
 * 是个 Web 惯例。所以这个组件里**每一个数字都是 [推定]** ——
 * 触发器几何借 iPadOS 菜单栏项、面板几何借菜单面板，各自都有实测出处，
 * 但「用在这里」没有依据。
 */
export default function NavigationMenuDemo() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>组件</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="flex w-[280px] flex-col gap-1">
              <NavigationMenuLink href="#sidebar">Sidebar</NavigationMenuLink>
              <NavigationMenuLink href="#menubar">Menubar</NavigationMenuLink>
              <NavigationMenuLink href="#table">Table</NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger>资源</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="flex w-[240px] flex-col gap-1">
              <NavigationMenuLink href="#metrics">度量表</NavigationMenuLink>
              <NavigationMenuLink href="#status">阶段状态</NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuLink href="#about">关于</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
