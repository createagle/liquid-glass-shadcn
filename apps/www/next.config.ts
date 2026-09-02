import type { NextConfig } from 'next';

/**
 * `typedRoutes` 打开是刻意的：组件页的链接是从 registry.json 拼出来的，
 * 拼错了要在编译期就红，而不是上线后 404。
 * （代价是拼接出来的字符串要显式断言 —— 见 site-sidebar.tsx。）
 */
const config: NextConfig = {
  typedRoutes: true,
};

export default config;
