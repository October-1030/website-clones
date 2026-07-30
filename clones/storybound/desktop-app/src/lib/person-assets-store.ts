export interface PersonAsset {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
}

export interface PersonGroup {
  id: string;
  name: string;
  note: string;
  assets: PersonAsset[];
}

export const personAssetsStorageKey = "storybound-person-assets-v1";
export const personAssetsStoreEvent = "storybound-person-assets-changed";

export function readPersonGroups(): PersonGroup[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(personAssetsStorageKey) || "[]") as PersonGroup[];
    return Array.isArray(value)
      ? value.filter((group) => group?.id && group?.name && Array.isArray(group.assets))
      : [];
  } catch {
    return [];
  }
}

export function writePersonGroups(groups: PersonGroup[]): void {
  window.localStorage.setItem(personAssetsStorageKey, JSON.stringify(groups));
  window.dispatchEvent(new Event(personAssetsStoreEvent));
}

export function fileToPersonAsset(file: File): Promise<PersonAsset> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/u.test(file.type)) {
      reject(new Error(`${file.name} 不是 JPEG、PNG 或 WebP 图片。`));
      return;
    }
    if (file.size > 1_500_000) {
      reject(new Error(`${file.name} 超过 1.5 MB，请先压缩。`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
    reader.onload = () => resolve({
      id: crypto.randomUUID(),
      name: file.name,
      dataUrl: String(reader.result || ""),
      createdAt: new Date().toISOString(),
    });
    reader.readAsDataURL(file);
  });
}

export async function personAssetToFile(asset: PersonAsset): Promise<File> {
  const response = await fetch(asset.dataUrl);
  if (!response.ok) throw new Error(`无法读取人物素材 ${asset.name}`);
  return new File([await response.blob()], asset.name, {
    type: response.headers.get("content-type") || "image/png",
  });
}
