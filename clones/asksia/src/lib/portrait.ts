export type PortraitStyle = "classic" | "leadership" | "black-and-white";

export const PORTRAIT_MAX_BYTES = 10 * 1024 * 1024;
export const portraitStyles: Record<PortraitStyle, { label: string; description: string; filter: string; background: string }> = {
  classic: { label: "Classic", description: "Warm, polished, and lightly contrasted.", filter: "contrast(1.06) saturate(0.92) brightness(1.02)", background: "#efe1d4" },
  leadership: { label: "Leadership", description: "Clean, confident, and slightly vivid.", filter: "contrast(1.1) saturate(1.08) brightness(1.03)", background: "#dce8eb" },
  "black-and-white": { label: "Black & white", description: "Minimal, high-contrast monochrome.", filter: "grayscale(1) contrast(1.18) brightness(1.02)", background: "#dedede" },
};

export interface PortraitFileLike {
  name: string;
  type: string;
  size: number;
}

export function validatePortraitFile(file: PortraitFileLike): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Choose a JPEG, PNG, or WebP image.";
  if (file.size <= 0) return "The selected image is empty.";
  if (file.size > PORTRAIT_MAX_BYTES) return "The selected image is larger than 10 MB.";
  return null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function portraitCropRect(
  width: number,
  height: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
): { sx: number; sy: number; size: number } {
  if (width <= 0 || height <= 0) throw new Error("Image dimensions are invalid.");
  const safeZoom = clamp(zoom, 1, 2);
  const size = Math.min(width, height) / safeZoom;
  const maxX = Math.max(0, width - size);
  const maxY = Math.max(0, height - size);
  const sx = clamp(maxX / 2 + clamp(offsetX, -100, 100) / 100 * maxX / 2, 0, maxX);
  const sy = clamp(maxY / 2 + clamp(offsetY, -100, 100) / 100 * maxY / 2, 0, maxY);
  return { sx, sy, size };
}
