import path from 'node:path';

export default function formatPath(p) {
  const sep = path.sep;
  // 如果返回 / 则为 macOS
  if (sep === '/') {
      return p;
  } else {
      return p.replace(/\\/g, '/');
  }
}
