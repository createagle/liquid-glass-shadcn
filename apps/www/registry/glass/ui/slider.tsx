'use client';

// APPLE REFERENCE: UISlider / SwiftUI `Slider`（iOS 26+ Liquid Glass）
//
// 尺寸来源：Apple Design Resources《iOS and iPadOS 27》Figma 文件
// （fileKey ojEQo0rKaQ5ioARo0CO0pf，节点 12740:33899），
// 示例帧 402×874 即 iPhone 16 Pro 逻辑点尺寸，故 Figma 数值直接是 pt。
// 完整测量记录见 docs/research/apple-metrics.md §7.4。
//
//   轨道                   250 × 6 pt              [实测]（高度经像素复核）
//   Knob                   38 × 24 pt（胶囊）      [实测]（**像素实测**）
//   列表行高               52 pt                    [实测]
//   刻度条（ticks）         218 × 4 pt              [实测]（本组件暂未实现）
//   轨道未填充色            rgb(228 228 228)        [实测]（仅记录，未用于 token）
//   轨道已填充色            rgb(0 136 255)          [实测]（仅记录，未用于 token）
//
// ⚠️ 可信度说明：上表标 [实测] 而非 [官方]，因为
//   (a) 该文件是 iOS 27，PROJECT_SPEC 的基准是 iOS 26；
//   (b) 文件标题带 "(Community)"，发布者是否为 Apple 未经验证。
//
// ⚠️ **Figma 节点包围盒在 Knob 上不可信** —— 实例 width 报为 1.11pt，
//    渲染图里却是宽胶囊。凡涉及 Knob 一律以像素实测为准。
//
// ⚠️ **填充色不采信为 token。** 实测 rgb(0 136 255) ≠ 常引用的 systemBlue #007AFF，
//    差异方向与 Display P3 → sRGB 一致但未经验证，故填充仍走 --lg-blue。
//
// ✅ 交叉印证：Switch 与 Slider 的 knob 都是 38 × 24 pt —— 两处独立节点得到
//    同一尺寸，说明 iOS 27 存在统一的 Knob 组件。这是本次测量可信度最高的一条。
//
// 刻意偏离 Apple 之处：
//   1. **触控高度撑到 44pt**。轨道 6pt + knob 24pt 都够不到 HIG 的 44×44pt
//      最小触控目标，故 Root 设 min-height: 44px，多出的高度是透明命中区。
//   2. **只做横向**。iOS 没有纵向 slider；Radix 的 orientation="vertical"
//      在本皮肤下不会得到正确几何。

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { motion } from 'motion/react';
import { GlassSurface, transitionFor, useGlassOptional } from '@glass/core';
import { cn } from '@/lib/utils';

/**
 * 几何 —— 从 iOS 27 实测值来，按 knob 高度成比例缩放。
 *
 * 不写死 pt 是因为 Web 上 slider 的宽度由容器决定；锁死的是**比例关系**，
 * 那才是设计语言里稳定的部分。
 */
const GEOMETRY = {
  /** knob 高度。iOS 27 实测 24pt。 */
  knobHeight: 24,
  /** knob 宽度。iOS 27 实测 38pt（**胶囊，不是圆**）。 */
  knobWidth: 38,
  /** 轨道高度。iOS 27 实测 6pt。 */
  trackHeight: 6,
  /** 最小触控目标。HIG 44×44pt，[官方]。 */
  minTouch: 44,
  /**
   * 交互时 knob 的放大倍数。
   *
   * PROJECT_SPEC §2「交互态才点亮」要求按下/拖动时**折射强度、色散偏移、
   * 高光亮度、缩放同时上扬**；前三项由 GlassSurface 的 pressed 负责，
   * 缩放在这里。
   *
   * ⚠️ 这两个倍数是 `[推定]` —— 没有 iOS 参考视频可以逐帧量，
   * 取值只保证「看得出来但不夸张」。
   */
  hoverScale: 1.04,
  pressScale: 1.1,
  /**
   * 按下 / 拖动时 knob 底色的不透明度倍数。
   *
   * 静止态 knob 是一块白色实体（--lg-knob-fill，依据见该 token 的注释）；
   * 交互时把这一层调淡，背后的折射与色散才真正显出来 ——
   * 这就是 Apple 那句 "the knob transforms into Liquid Glass during interaction"
   * 的字面实现，也是 PROJECT_SPEC §2「静止态弱、交互态强」的节奏。
   *
   * ⚠️ `[推定]` —— 没有真机可以标定「淡到什么程度」。
   */
  activeFillOpacity: 0.45,
} as const;

export interface GlassSliderProps
  extends Omit<React.ComponentProps<typeof SliderPrimitive.Root>, 'orientation'> {
  /** knob 高度（px）。默认 24，对应 iOS 27 实测值；其余几何按比例跟随。 */
  knobSize?: number;
}

function Slider({
  className,
  knobSize = GEOMETRY.knobHeight,
  style,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: GlassSliderProps) {
  const k = knobSize / GEOMETRY.knobHeight;
  const knobH = knobSize;
  const knobW = Math.round(GEOMETRY.knobWidth * k);
  const trackH = Math.max(1, Math.round(GEOMETRY.trackHeight * k));

  /**
   * 拖动态。Radix 不对外暴露「正在拖动」，所以自己在 Root 上收指针事件 ——
   * 从轨道任意处按下也算拖动（Radix 会让 knob 跳到该处并继续跟手），
   * 只监听 knob 自身的 pointerdown 会漏掉这条路径。
   */
  const [dragging, setDragging] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    if (!dragging) return;
    const release = () => setDragging(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [dragging]);

  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;
  const scale = dragging ? GEOMETRY.pressScale : hovered ? GEOMETRY.hoverScale : 1;

  // 受控 / 非受控都要能算出有几个 knob
  const values = value ?? defaultValue ?? [min];

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      orientation="horizontal"
      min={min}
      max={max}
      {...(value !== undefined ? { value } : {})}
      {...(defaultValue !== undefined ? { defaultValue } : {})}
      className={cn(
        'relative flex w-full touch-none items-center select-none',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        className,
      )}
      style={
        {
          minHeight: GEOMETRY.minTouch,
          '--lg-slider-knob-h': `${knobH}px`,
          '--lg-slider-knob-w': `${knobW}px`,
          '--lg-slider-track-h': `${trackH}px`,
          ...style,
        } as React.CSSProperties
      }
      onPointerDown={() => setDragging(true)}
      {...props}
    >
      {/*
        Layer B —— 轨道与已填充段。
        PROJECT_SPEC §2 的分层速查表把「轨道 + 已填充段」整体归为 Layer B：
        它是磨砂底座，**绝不折射**，填充只是压在底座上的一层颜色。

        为什么 GlassSurface 在 Track 里面而不是 Track 本身：
        Radix 的 Track 需要拿到自己的 ref 做指针换算，而 GlassSurface 内部
        已经把 ref 交给了 useGlassFilter，用 asChild 转交会把它顶掉。
        Range 靠 context 定位，嵌深一层不影响。
      */}
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative w-full grow"
        style={{ height: 'var(--lg-slider-track-h)' }}
      >
        <GlassSurface
          layer="base"
          radius={trackH / 2}
          className="overflow-hidden"
          // 定位走内联样式，不用 Tailwind 的 absolute inset-0：
          // `.lg-surface` 自己声明了 position: relative，工具类能不能盖住它
          // 取决于 CSS 的 @layer 顺序 —— registry 安装时 optics 在
          // @layer components 里（工具类赢），而直接 <link> 引 theme.css 时
          // 它是无层的（工具类输）。内联样式两种情况下都对。
          style={{ position: 'absolute', inset: 0 }}
        >
          <SliderPrimitive.Range
            data-slot="slider-range"
            className="absolute inset-y-0"
            // 填充用系统色本身（而不是 on-glass 变体）—— 它是背景不是文字。
            // Apple: "apply color to the background rather than to symbols or text."
            style={{ background: 'var(--lg-slider-fill, var(--lg-blue))' }}
          />
        </GlassSurface>
      </SliderPrimitive.Track>

      {/*
        Layer I —— knob。这里才是真正的 Liquid Glass。

        没有给轨道挖洞，理由：knob 高 24px、轨道只有 6px，轨道的模糊最多
        影响 knob 中央 25% 的面积，而径向位移场在中心接近于零 —— 挖洞买不到
        可见收益，却要在拖动的**每一帧**重算 clip-path。
        （Switch 的情况相反：knob 24 / 轨道 28，几乎完全重叠，那边挖。）
      */}
      {values.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          data-slot="slider-thumb"
          className={cn(
            'block rounded-full outline-none',
            'focus-visible:ring-2 focus-visible:ring-[var(--lg-ring)] focus-visible:ring-offset-2',
            'focus-visible:ring-offset-transparent',
          )}
          style={{ width: 'var(--lg-slider-knob-w)', height: 'var(--lg-slider-knob-h)' }}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        >
          <motion.span
            className="block h-full w-full"
            animate={{ scale }}
            transition={transitionFor(dragging ? 'snappy' : 'smooth', reducedMotion)}
          >
            <GlassSurface
              layer="indicator"
              radius={knobH / 2}
              pressed={dragging}
              className="h-full w-full"
            >
            {/* 白色底色层：静止态遮住轨道颜色，交互时淡出让玻璃显形 */}
            <motion.span
              aria-hidden="true"
              data-slot="slider-knob-fill"
              className="absolute inset-0 rounded-[inherit]"
              style={{ background: 'var(--lg-knob-fill)' }}
              initial={false}
              animate={{ opacity: dragging ? GEOMETRY.activeFillOpacity : 1 }}
              transition={transitionFor('snappy', reducedMotion)}
            />
            </GlassSurface>
          </motion.span>
        </SliderPrimitive.Thumb>
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
