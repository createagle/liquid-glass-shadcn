/**
 * 首屏防闪烁内联脚本。对应 PROJECT_SPEC §8。
 *
 * 主题、材质档位、tier 三者共用同一套机制：
 * 在 `<head>` 里同步执行，**在首次绘制之前**把属性写到 `<html>` 上，
 * 这样服务端渲染出来的标记与客户端第一帧完全一致，不会出现暗色/材质闪烁。
 *
 * 用法（Next.js App Router）：
 * ```tsx
 * <head>
 *   <script dangerouslySetInnerHTML={{ __html: glassSsrScript() }} />
 * </head>
 * ```
 */

export const STORAGE_KEYS = {
  theme: 'lg:theme',
  tint: 'lg:tint',
  tier: 'lg:tier',
} as const;

export interface SsrScriptOptions {
  /** 无存储值时的默认主题 */
  defaultTheme?: 'light' | 'dark' | 'system';
  /** 无存储值时的默认材质档位（0..1） */
  defaultTint?: number;
}

export function glassSsrScript(options: SsrScriptOptions = {}): string {
  const { defaultTheme = 'system', defaultTint = 0.34 } = options;

  // 压成一行，避免注入到 HTML 里带一堆空白
  return `(function(){try{
var d=document.documentElement,ls=null;
try{ls=localStorage}catch(e){}
var t=(ls&&ls.getItem(${JSON.stringify(STORAGE_KEYS.theme)}))||${JSON.stringify(defaultTheme)};
var dark=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
d.classList.toggle('dark',dark);
d.setAttribute('data-glass-theme',dark?'dark':'light');
var v=ls&&ls.getItem(${JSON.stringify(STORAGE_KEYS.tint)});
var n=v==null?${defaultTint}:parseFloat(v);
if(!(n>=0&&n<=1))n=${defaultTint};
d.setAttribute('data-glass-tint',String(n));
d.style.setProperty('--lg-tint',String(n));
var forced=ls&&ls.getItem(${JSON.stringify(STORAGE_KEYS.tier)});
var tier=forced||(function(){
  if(typeof CSS==='undefined'||!CSS.supports)return 'c';
  var blur=CSS.supports('backdrop-filter','blur(10px)');
  if(blur&&CSS.supports('backdrop-filter','url(#x)'))return 'a';
  if(blur||CSS.supports('-webkit-backdrop-filter','blur(10px)'))return 'b';
  return 'c';
})();
d.setAttribute('data-glass-tier',tier);
}catch(e){}})();`.replace(/\n/g, '');
}
