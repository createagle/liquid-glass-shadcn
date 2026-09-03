'use client';

// APPLE REFERENCE: 无
//
// ⚠️ **Apple 没有 Avatar 控件。** 通讯录、信息、FaceTime 里的圆形头像是各家 App
// 自己画的，HIG 里没有对应的组件规范，设计资源里也没有可量的样例。
// **本组件的几何全部 `[推定]`**，唯一有依据的是字号阶梯（apple-metrics §7.6）。
//
// 分层：**内容层，不用玻璃**。头像装的是照片 —— 照片本身就是内容，
// 在它上面糊一层材质只会把内容弄糊（PROJECT_SPEC §2）。

import * as React from 'react';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 默认边长（px）。`[推定]` —— 取 HIG 最小触控目标 44 的下一档 */
  size: 40,
  /** 首字母相对边长的比例。`[推定]` */
  initialsRatio: 0.4,
} as const;

export interface GlassAvatarProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  /**
   * 图片地址。加载失败或不传时显示 `fallback`。
   *
   * ⚠️ 类型刻意写成 `string | undefined` 而不是只写 `?:`。
   * 本仓库开了 `exactOptionalPropertyTypes`，那种写法下
   * `<Avatar src={user.avatarUrl} />`（值的类型是 `string | undefined`）**编译不过**，
   * 调用方得写成 `{...(url ? { src: url } : {})}` —— 而头像地址来自数据、
   * 天然可能是 undefined，这是最常见的用法，不该逼调用方绕。
   */
  src?: string | undefined;
  /** 无障碍名称。有图时必须给 —— 头像通常代表一个人，不是装饰。 */
  alt?: string | undefined;
  /**
   * 图片不可用时显示的内容，通常是姓名首字母。
   *
   * ⚠️ 不要在这里塞人名全称：这块地方只有 40px 宽，塞进去会被裁掉，
   * 而屏幕阅读器读到的是 `alt`，不是它。
   */
  fallback?: React.ReactNode;
  /** 边长（px）。默认 40。 */
  size?: number;
}

function Avatar({
  className,
  src,
  alt,
  fallback,
  size = GEOMETRY.size,
  style,
  ...props
}: GlassAvatarProps) {
  /**
   * 三态：没给 src / 正在加载 / 加载失败。
   *
   * ⚠️ 必须用 `key={src}` 之外的方式重置状态 —— 换 src 之后如果不把 failed
   * 清掉，第一张图失败会让后面所有图都显示不出来。这里用 effect 在 src 变化时重置。
   */
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !failed;

  return (
    <span
      data-slot="avatar"
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden select-none',
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        // 底色只在图缺席时看得到；用 fill 家族而不是 card-fill，
        // 因为头像常常压在列表行上，需要和行底色区分开
        background: 'var(--lg-fill-secondary)',
        color: 'var(--lg-label-secondary)',
        ...style,
      }}
      {...props}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- registry 组件不依赖 next/image
        <img
          data-slot="avatar-image"
          src={src}
          alt={alt ?? ''}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span
          data-slot="avatar-fallback"
          /**
           * 图缺席时，无障碍名称落在这一层。
           * 没有 alt 也没有 fallback 时整个头像对 AT 隐藏 ——
           * 一个既没有名字也没有内容的圆圈对屏幕阅读器只是噪音。
           */
          {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': 'true' })}
          className="font-semibold"
          style={{ fontSize: Math.round(size * GEOMETRY.initialsRatio) }}
        >
          {fallback}
        </span>
      )}
    </span>
  );
}

export { Avatar, GEOMETRY as AVATAR_GEOMETRY };
