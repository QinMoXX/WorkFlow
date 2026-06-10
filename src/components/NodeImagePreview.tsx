import { convertFileSrc } from "@tauri-apps/api/core";

export interface ReadonlyNodeImagePreviewProps {
  readonly path?: string;
  readonly label: string;
}

function toImageSource(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return convertFileSrc(path);
}

export function NodeImagePreview({ path, label }: ReadonlyNodeImagePreviewProps) {
  if (!path) return null;

  return (
    <figure className="mt-3 grid gap-2">
      <img
        className="aspect-[4/3] w-full rounded-md border border-border-subtle bg-canvas object-cover"
        src={toImageSource(path)}
        alt={label}
        loading="lazy"
      />
      <figcaption className="truncate text-[11px] leading-4 text-text-muted" title={path}>
        {path}
      </figcaption>
    </figure>
  );
}
