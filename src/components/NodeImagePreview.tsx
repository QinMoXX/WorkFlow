import { convertFileSrc } from "@tauri-apps/api/core";

type NodeImagePreviewProps = {
  path?: string;
  label: string;
};

function toImageSource(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return convertFileSrc(path);
}

export function NodeImagePreview({ path, label }: NodeImagePreviewProps) {
  if (!path) return null;

  return (
    <figure className="node-image-preview">
      <img src={toImageSource(path)} alt={label} loading="lazy" />
      <figcaption title={path}>{path}</figcaption>
    </figure>
  );
}
