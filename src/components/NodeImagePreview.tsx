import { toImageSource } from "../lib/imageSource";

export interface ReadonlyNodeImagePreviewProps {
  readonly path?: string;
  readonly label: string;
}

export function NodeImagePreview({ path, label }: ReadonlyNodeImagePreviewProps) {
  if (!path) return null;

  return (
    <figure className="grid">
      <img
        className="aspect-[4/3] w-full rounded-md border border-border-subtle bg-canvas object-cover"
        src={toImageSource(path)}
        alt={label}
        loading="lazy"
      />
    </figure>
  );
}
