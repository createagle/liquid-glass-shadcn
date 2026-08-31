/**
 * 最小 npm registry shim。
 *
 * 为什么需要它：registry 的 theme / glass-providers item 声明了
 * `dependencies: ["@glass/core"]`，`shadcn add` 会真的执行 `npm install @glass/core`。
 * 在 @glass/core 正式发布到 npm 之前，冒烟测试跑不下去。
 *
 * 这个 shim 只服务一个本地打好的 tarball，让冒烟测试能覆盖**真实的依赖安装路径**，
 * 而不是绕过它。@glass/core 发布之后这个脚本就可以删掉。
 *
 * 用法：
 *   node scripts/npm-registry-shim.mjs <tarball.tgz> [port]
 * 消费端：
 *   echo "@glass:registry=http://localhost:<port>" > .npmrc
 */

import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const tarballPath = resolve(process.argv[2] ?? '');
const PORT = Number(process.argv[3] ?? 4181);

if (!process.argv[2]) {
  console.error('用法: node scripts/npm-registry-shim.mjs <tarball.tgz> [port]');
  process.exit(1);
}

const tarball = readFileSync(tarballPath);
const shasum = createHash('sha1').update(tarball).digest('hex');
const integrity = 'sha512-' + createHash('sha512').update(tarball).digest('base64');

/**
 * 从 tarball 里读出真正的 package.json，避免手写元数据与包本身漂移。
 *
 * 用纯 Node 实现（gunzip + 手工走 tar 头），不外调 `tar` ——
 * Windows 上的 GNU tar 会把 `C:\…` 当成远程主机规格而失败。
 */
function readManifestFromTarball(path) {
  const buf = gunzipSync(readFileSync(path));
  let offset = 0;
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    if (!name) break; // 连续两个空块 = 归档结束
    const sizeField = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim();
    const size = Number.parseInt(sizeField, 8) || 0;
    const body = buf.subarray(offset + 512, offset + 512 + size);
    if (name === 'package/package.json') return JSON.parse(body.toString('utf8'));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error(`tarball 里没有找到 package/package.json：${path}`);
}

const manifest = readManifestFromTarball(tarballPath);
const NAME = manifest.name;
const VERSION = manifest.version;
const TARBALL_URL = `http://localhost:${PORT}/${NAME}/-/${NAME.split('/').pop()}-${VERSION}.tgz`;

const packument = {
  _id: NAME,
  name: NAME,
  'dist-tags': { latest: VERSION },
  versions: {
    [VERSION]: {
      ...manifest,
      dist: { tarball: TARBALL_URL, shasum, integrity },
    },
  },
};

createServer((req, res) => {
  const url = decodeURIComponent(req.url ?? '/');
  if (url.endsWith('.tgz')) {
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': statSync(tarballPath).size,
    });
    res.end(tarball);
    return;
  }
  if (url.includes(NAME) || url.includes(NAME.replace('/', '%2f'))) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(packument));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end('{"error":"not found"}');
}).listen(PORT, () => {
  console.log(`npm shim → http://localhost:${PORT} （仅服务 ${NAME}@${VERSION}）`);
});
