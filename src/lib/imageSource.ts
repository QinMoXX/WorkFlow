import { convertFileSrc } from "@tauri-apps/api/core";

const DIRECT_IMAGE_SOURCE_PATTERN = /^(https?:|data:|blob:|asset:|tauri:)/i;
const WINDOWS_FILE_URL_PATTERN = /^\/[a-z]:\//i;

export function toImageSource(path: string) {
  const source = path.trim();
  if (DIRECT_IMAGE_SOURCE_PATTERN.test(source)) return source;
  return convertFileSrc(fileUrlToPath(source));
}

function fileUrlToPath(source: string) {
  if (!source.toLowerCase().startsWith("file:")) return source;

  try {
    const url = new URL(source);
    const pathname = decodeURIComponent(url.pathname);
    if (WINDOWS_FILE_URL_PATTERN.test(pathname)) return pathname.slice(1);
    return pathname;
  } catch {
    return source;
  }
}
