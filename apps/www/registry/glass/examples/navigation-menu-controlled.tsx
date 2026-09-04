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
 * 受控 —— `value` / `onValueChange` 直通 Radix。
 *
 * 本库在 Root 上**自己也留了一份** open 状态：视口的玻璃底是 Viewport 的
 * 兄弟节点（Radix 的 Viewport 会把 children 解构掉扔了，塞不进去），
 * 关闭时得由我们把那块玻璃摘掉，否则页面上会留下一道还在投影的边。
 */
export default function NavigationMenuControlled() {
  const [value, setValue] = React.useState('');
  return (
    <div className="flex flex-col items-center gap-4">
      <NavigationMenu value={value} onValueChange={setValue}>
        <NavigationMenuList>
          <NavigationMenuItem value="a">
            <NavigationMenuTrigger>第一项</NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="flex w-[220px] flex-col gap-1">
                <NavigationMenuLink href="#one">内容 A1</NavigationMenuLink>
                <NavigationMenuLink href="#two">内容 A2</NavigationMenuLink>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem value="b">
            <NavigationMenuTrigger>第二项</NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="flex w-[220px] flex-col gap-1">
                <NavigationMenuLink href="#three">内容 B1</NavigationMenuLink>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
      <span className="text-[13px] text-[var(--lg-label-secondary)]">
        当前展开：{value === '' ? '（无）' : value}
      </span>
    </div>
  );
}
