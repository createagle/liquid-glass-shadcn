'use client';

// APPLE REFERENCE: UISwitch / SwiftUI `Toggle`（iOS 26+ Liquid Glass）
//
// 尺寸来源：Apple Design Resources《iOS and iPadOS 27》Figma 文件
// （fileKey ojEQo0rKaQ5ioARo0CO0pf，节点 I12740:33924;550:50638;526:49260）。
// 完整测量记录见 docs/research/apple-metrics.md §7.3。
//
//   轨道        64 × 28 pt                    [实测]
//   Knob        38 × 24 pt（**胶囊，不是圆**）  [实测]
//   Knob 内缩    2 pt（四周）                  [实测]
//   Knob 行程    22 pt（x 从 2 到 24）          [实测]
//
// ⚠️⚠️ **本组件与 PROJECT_SPEC §10 冲突，且是刻意的。**
//
//   PROJECT_SPEC 把「UISwitch 51×31pt，knob 直径 27pt」列在
//   「已核实可直接使用的 Apple 度量」里。Phase 0 在 iOS 27 官方设计资源上
//   实测到的是 64×28、knob 38×24 胶囊 —— **尺寸与形状都不同**。
//
//   51×31 是 Liquid Glass 之前的 UIKit 旧版度量。本组件按实测值实现，
//   因为一个直径 27pt 的圆形 knob 塞不进 28pt 高的轨道，两者不可能同时成立。
//
//   这需要修订 PROJECT_SPEC —— 已在 docs/research/apple-metrics.md §7.3
//   与 STATUS.md 记录。**在 SPEC 修订前，这里是一处已知的、公开标注的偏离。**
//
// ⚠️ 可信度说明：上表标 [实测] 而非 [官方]，因为
//   (a) 该文件是 iOS 27，PROJECT_SPEC 的基准是 iOS 26；
//   (b) 文件标题带 "(Community)"，发布者是否为 Apple 未经验证。
//
// ✅ 交叉印证：Slider 的 knob 也是 38 × 24 pt（另一个独立节点），
//    说明 iOS 27 存在统一的 Knob 组件。这是本次测量可信度最高的一条。
// ✅ 同心圆角自洽：轨道半径 14 − 内缩 2 = 12 = knob 高 24 的一半，
//    即 concentricRadius(14, 2) 恰好给出胶囊 knob。
//
// 刻意偏离 Apple 之处：
//   **触控高度撑到 44pt**。轨道 28pt 够不到 HIG 的 44×44pt 最小触控目标，
//   故用一层透明的溢出命中区把可点区域补到 44pt。

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { motion } from 'motion/react';
import {
  GlassSurface,
  concentricRadius,
  transitionFor,
  useGlassOptional,
  type GlassPunch,
} from '@glass/core';
import { cn } from '@/lib/utils';

/** 几何 —— iOS 27 实测值，按轨道高度成比例缩放。 */
const GEOMETRY = {
  /** 轨道高。iOS 27 实测 28pt。 */
  trackHeight: 28,
  /** 轨道宽。iOS 27 实测 64pt。 */
  trackWidth: 64,
  /** knob 高。iOS 27 实测 24pt。 */
  knobHeight: 24,
  /** knob 宽。iOS 27 实测 38pt（胶囊）。 */
  knobWidth: 38,
  /** knob 四周内缩。iOS 27 实测 2pt。 */
  inset: 2,
  /** 最小触控目标。HIG 44×44pt，[官方]。 */
  minTouch: 44,
  /**
   * 交互时 knob 的放大倍数。PROJECT_SPEC §2 要求按下时缩放与折射同时上扬。
   * ⚠️ `[推定]` —— 没有 iOS 参考视频可逐帧量，取值只保证看得出来但不夸张。
   */
  hoverScale: 1.03,
  pressScale: 1.08,
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
  /**
   * 洞比 knob 每边多挖出的量（px）。
   *
   * knob 按下时会放大，洞如果严丝合缝，四周就会露出一圈仍被模糊的背景。
   * 让洞恒定大一点，代价是 knob 边缘外有一圈未模糊的背景 —— 它正好被
   * knob 自身的落影盖住，比露出模糊环好得多。
   */
  punchBleed: 1.5,
} as const;

export interface GlassSwitchProps extends React.ComponentProps<typeof SwitchPrimitive.Root> {
  /** 轨道高度（px）。默认 28，对应 iOS 27 实测值；其余几何按比例跟随。 */
  size?: number;
}

function Switch({
  className,
  size = GEOMETRY.trackHeight,
  style,
  checked: checkedProp,
  defaultChecked,
  ...props
}: GlassSwitchProps) {
  const k = size / GEOMETRY.trackHeight;
  const trackH = size;
  const trackW = Math.round(GEOMETRY.trackWidth * k);
  const knobH = Math.round(GEOMETRY.knobHeight * k);
  const knobW = Math.round(GEOMETRY.knobWidth * k);
  const inset = Math.round(GEOMETRY.inset * k);
  const travel = trackW - inset * 2 - knobW;

  const trackRadius = trackH / 2;
  // 同心圆角：14 − 2 = 12 = knobH/2，恰好是胶囊。公式与 iOS 实测自洽。
  const knobRadius = concentricRadius(trackRadius, inset);

  const rootRef = React.useRef<HTMLButtonElement>(null);
  /**
   * 初值直接从 props 推出来，**不要**从 false 起步再由 effect 纠正。
   *
   * 从 false 起步的话，defaultChecked 的开关在挂载后会从关闭位滑到开启位 ——
   * 首屏就播一段本不该有的动画（实测：加载 150ms 后 knob 还在 x=18 而不是 24）。
   * 这里推出的正是 Radix 自己会用的初值，随后由下面的 MutationObserver 接管。
   */
  const [checked, setChecked] = React.useState(checkedProp ?? defaultChecked ?? false);
  const [pressed, setPressed] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [punch, setPunch] = React.useState<GlassPunch | null>(null);

  /**
   * 从 DOM 读选中态，而不是自己再维护一份。
   *
   * Radix 的受控 / 非受控两条路径都会把结果写到 data-state 上，观察它就同时
   * 覆盖两种用法，也不会和 Radix 的内部状态打架。同一手法在 Tabs 里用过。
   */
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const sync = () => setChecked(el.getAttribute('data-state') === 'checked');
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(el, { attributes: true, attributeFilter: ['data-state'] });
    return () => mo.disconnect();
  }, []);

  React.useEffect(() => {
    if (!pressed) return;
    const release = () => setPressed(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [pressed]);

  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;
  const scale = pressed ? GEOMETRY.pressScale : hovered ? GEOMETRY.hoverScale : 1;

  /**
   * 洞跟着 knob 走。
   *
   * 用 motion 的 onUpdate 逐帧同步，而不是按 checked 直接跳到终点 ——
   * 后者会让洞在 knob 还在路上时就已经到位，中途露出一块不该清晰的背景。
   * 这样位置只有一个来源（同一个动画值），两者不可能对不上。
   *
   * 代价是切换期间每帧一次 setState（约 0.5s / 30 次）。只在动画进行时发生，
   * 静止后 motion 不再触发 onUpdate。
   */
  const syncPunch = React.useCallback(
    (x: number) => {
      const b = GEOMETRY.punchBleed;
      setPunch((prev) => {
        const next: GlassPunch = {
          x: inset + x - b,
          y: inset - b,
          width: knobW + b * 2,
          height: knobH + b * 2,
          radius: knobRadius + b,
        };
        return prev && Math.abs(prev.x - next.x) < 0.5 ? prev : next;
      });
    },
    [inset, knobW, knobH, knobRadius],
  );

  // 首帧：动画还没跑过，onUpdate 不会触发，得先按当前状态放一次
  React.useEffect(() => {
    syncPunch(checked ? travel : 0);
  }, [checked, travel, syncPunch]);

  const hitInset = Math.max(0, (GEOMETRY.minTouch - trackH) / 2);

  return (
    <SwitchPrimitive.Root
      ref={rootRef}
      data-slot="switch"
      className={cn(
        'relative inline-flex shrink-0 items-center outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--lg-ring)] focus-visible:ring-offset-2',
        'focus-visible:ring-offset-transparent',
        'disabled:pointer-events-none data-[disabled]:opacity-40',
        className,
      )}
      style={
        {
          width: trackW,
          height: trackH,
          borderRadius: trackRadius,
          ...style,
        } as React.CSSProperties
      }
      onPointerDown={() => setPressed(true)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      {...(checkedProp !== undefined ? { checked: checkedProp } : {})}
      {...(defaultChecked !== undefined ? { defaultChecked } : {})}
      {...props}
    >
      {/*
        触控命中区。轨道只有 28pt 高，够不到 HIG 的 44×44pt。
        放在最前面：它是透明的，但如果排在 knob 之后就会抢走 knob 的 hover。
      */}
      <span
        aria-hidden="true"
        data-slot="switch-hit-area"
        className="absolute inset-x-0"
        style={{ top: -hitInset, bottom: -hitInset }}
      />

      {/*
        Layer B —— 轨道。磨砂底座，**绝不折射**（PROJECT_SPEC §15.2）。
        按 knob 位置挖洞，让 knob 看到未被轨道模糊过的背景（§2）。

        这里挖洞是划算的：knob 24 高、轨道 28 高，几乎完全重叠 ——
        不挖就是「两层磨砂叠加」，正是 §2 明确反对的。
        （Slider 相反：knob 24 / 轨道 6，重叠面积小，那边不挖。）
      */}
      <GlassSurface
        layer="base"
        radius={trackRadius}
        punch={punch}
        // 定位走内联样式，不用 Tailwind 的 absolute inset-0：
        // `.lg-surface` 自己声明了 position: relative，工具类能不能盖住它
        // 取决于 CSS 的 @layer 顺序 —— registry 安装时 optics 在
        // @layer components 里（工具类赢），而直接 <link> 引 theme.css 时
        // 它是无层的（工具类输）。内联样式两种情况下都对。
        style={{ position: 'absolute', inset: 0 }}
      >
        {/*
          开启态的着色。压在挖洞层之上，所以开启时看不到模糊差异 —— 这是对的：
          iOS 开启态的轨道就是一块实色，knob 折射的正是这块颜色。
          用 opacity 过渡而不是 background-color 过渡，spring 才有意义。
        */}
        <motion.span
          aria-hidden="true"
          data-slot="switch-fill"
          className="absolute inset-0 rounded-[inherit]"
          style={{ background: 'var(--lg-switch-fill, var(--lg-green))' }}
          initial={false}
          animate={{ opacity: checked ? 1 : 0 }}
          transition={transitionFor('smooth', reducedMotion)}
        />
      </GlassSurface>

      {/*
        Layer I —— knob。这里才是真正的 Liquid Glass。

        ⚠️ **刻意不用 `asChild`。** shadcn 的 add 在目标工程的 style 以 `base-`
        开头时（`shadcn init -d` 现在的默认值），会把 `<X asChild><Y/></X>` 改写成
        `<X render={<Y/>} />` —— 那是 Base UI 的 API，而本组件用的是
        `@radix-ui/react-switch`，装到别人工程里会直接类型报错。
        （registry 冒烟测试在干净工程里抓到过一次，见 STATUS.md §0.3。）
        所以把 motion 包在外层、Thumb 放里层，效果一样且不触发那个改写。
      */}
      <motion.span
        className="absolute block"
        style={{ left: inset, top: inset, width: knobW, height: knobH }}
        initial={false}
        animate={{ x: checked ? travel : 0, scale }}
        transition={transitionFor('snappy', reducedMotion)}
        onUpdate={(latest) => {
          const raw = latest['x'];
          const x = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
          if (Number.isFinite(x)) syncPunch(x);
        }}
      >
        <SwitchPrimitive.Thumb data-slot="switch-thumb" className="block h-full w-full">
          <GlassSurface
            layer="indicator"
            radius={knobRadius}
            pressed={pressed}
            className="h-full w-full"
          >
            {/* 白色底色层：静止态遮住轨道颜色，交互时淡出让玻璃显形 */}
            <motion.span
              aria-hidden="true"
              data-slot="switch-knob-fill"
              className="absolute inset-0 rounded-[inherit]"
              style={{ background: 'var(--lg-knob-fill)' }}
              initial={false}
              animate={{ opacity: pressed ? GEOMETRY.activeFillOpacity : 1 }}
              transition={transitionFor('snappy', reducedMotion)}
            />
          </GlassSurface>
        </SwitchPrimitive.Thumb>
      </motion.span>
    </SwitchPrimitive.Root>
  );
}

export { Switch };
