import { mkdir, writeFile } from 'node:fs/promises';
const assets = [{ url: 'https://xingyuexiezuo.com/favicon.ico', path: 'public/seo/favicon.ico' }];
for (const asset of assets) {
  const response = await fetch(asset.url);
  if (!response.ok) throw new Error(`${response.status}: ${asset.url}`);
  const target = new URL('../' + asset.path, import.meta.url);
  await mkdir(new URL('.', target), { recursive: true });
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  console.log(asset.path);
}
