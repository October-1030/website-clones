import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('public');
const assets = [
  ['images/asksia/logo.png', 'https://cdn.asksia.ai/images/70e72382bddc4abba8733eab73e5cd7c.png'],
  ['images/asksia/back-to-school-banner.svg', 'https://www.asksia.ai/seo/back-to-school-banner.svg'],
  ['images/asksia/footer.svg', 'https://www.asksia.ai/svg/footer.svg'],
  ['images/asksia/footer1.svg', 'https://www.asksia.ai/svg/footer1.svg'],
  ['images/asksia/footer2.svg', 'https://www.asksia.ai/svg/footer2.svg'],
  ['images/asksia/footer3.svg', 'https://www.asksia.ai/svg/footer3.svg'],
  ['seo/asksia.ico', 'https://www.asksia.ai/asksia.ico'],
  ...[0, 1, 2, 3, 4, 5].map((n) => [`images/asksia/social-${n}.svg`, `https://www.asksia.ai/social/Social${n}.svg`]),
  ...[11, 12, 13, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 30].map((n) => [`images/asksia/school-${n}.png`, `https://www.asksia.ai/school/${n}.png`]),
];

for (const [relative, url] of assets) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  console.log(`${relative} <- ${url}`);
}
