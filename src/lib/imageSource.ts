import { convertFileSrc } from "@tauri-apps/api/core";

const DIRECT_IMAGE_SOURCE_PATTERN = /^(https?:|data:|blob:|file:|asset:|tauri:)/i;

export function toImageSource(path: string) {
  if (DIRECT_IMAGE_SOURCE_PATTERN.test(path)) return path;
  return convertFileSrc(path);
}
