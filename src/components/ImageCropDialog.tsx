import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { X } from "lucide-react";
import { toImageSource } from "../lib/imageSource";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

type DragMode =
  | { type: "image"; start: Point; offset: Point; target: Element }
  | { type: "crop"; start: Point; crop: Rect; target: Element }
  | { type: "resize"; handle: ResizeHandle; start: Point; crop: Rect; target: Element };

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type CroppedImageResult = {
  dataUrl: string;
  thumbnailDataUrl: string;
  width: number;
  height: number;
};

export interface ReadonlyImageCropDialogProps {
  readonly imagePath: string | null;
  readonly isSaving: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: (result: CroppedImageResult) => Promise<void> | void;
}

const MIN_CROP_SCREEN_SIZE = 40;
const MAX_THUMBNAIL_SIZE = 420;

const cropDialogCopy = {
  title: "裁剪图片",
  sizeTitle: "分辨率",
  width: "宽度",
  height: "高度",
  cancel: "取消",
  confirm: "确认裁剪",
  loading: "读取图片中",
  empty: "无法读取图片",
};

export function ImageCropDialog({ imagePath, isSaving, onCancel, onConfirm }: ReadonlyImageCropDialogProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragMode | null>(null);
  const [stageSize, setStageSize] = useState({ width: 640, height: 460 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [imageOffset, setImageOffset] = useState<Point>({ x: 0, y: 0 });
  const [crop, setCrop] = useState<Rect>({ x: 120, y: 90, width: 360, height: 260 });
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imageSource = useMemo(() => (imagePath ? toImageSource(imagePath) : ""), [imagePath]);
  const imageBounds = useMemo(
    () => ({
      x: imageOffset.x,
      y: imageOffset.y,
      width: imageSize.width * scale,
      height: imageSize.height * scale,
    }),
    [imageOffset.x, imageOffset.y, imageSize.height, imageSize.width, scale],
  );
  const sourceCrop = useMemo(() => screenRectToSourceRect(crop, imageOffset, scale, imageSize), [
    crop,
    imageOffset,
    imageSize,
    scale,
  ]);

  useEffect(() => {
    if (!imagePath) return undefined;
    setImageSize({ width: 0, height: 0 });
    setIsImageLoaded(false);
    setError(null);
    dragRef.current = null;
    return undefined;
  }, [imagePath]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setStageSize({
        width: Math.max(360, rect.width),
        height: Math.max(320, rect.height),
      });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const fitImageToStage = useCallback(
    (naturalWidth: number, naturalHeight: number) => {
      const nextScale = Math.min(
        1,
        Math.max(0.05, Math.min(stageSize.width / naturalWidth, stageSize.height / naturalHeight) * 0.86),
      );
      const displayWidth = naturalWidth * nextScale;
      const displayHeight = naturalHeight * nextScale;
      const nextOffset = {
        x: (stageSize.width - displayWidth) / 2,
        y: (stageSize.height - displayHeight) / 2,
      };
      const cropWidth = Math.max(MIN_CROP_SCREEN_SIZE, displayWidth * 0.72);
      const cropHeight = Math.max(MIN_CROP_SCREEN_SIZE, displayHeight * 0.72);

      setImageSize({ width: naturalWidth, height: naturalHeight });
      setScale(nextScale);
      setImageOffset(nextOffset);
      setCrop({
        x: nextOffset.x + (displayWidth - cropWidth) / 2,
        y: nextOffset.y + (displayHeight - cropHeight) / 2,
        width: cropWidth,
        height: cropHeight,
      });
      setIsImageLoaded(true);
    },
    [stageSize.height, stageSize.width],
  );

  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image || image.naturalWidth === 0 || image.naturalHeight === 0) {
      setError(cropDialogCopy.empty);
      return;
    }
    fitImageToStage(image.naturalWidth, image.naturalHeight);
  };

  const updateSourceSize = (axis: "width" | "height", value: string) => {
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const current = screenRectToSourceRect(crop, imageOffset, scale, imageSize);
    const nextWidth = axis === "width" ? Math.min(parsed, imageSize.width) : current.width;
    const nextHeight = axis === "height" ? Math.min(parsed, imageSize.height) : current.height;
    const centerX = current.x + current.width / 2;
    const centerY = current.y + current.height / 2;
    const nextSource = clampSourceRect(
      {
        x: centerX - nextWidth / 2,
        y: centerY - nextHeight / 2,
        width: nextWidth,
        height: nextHeight,
      },
      imageSize,
    );

    setCrop(sourceRectToScreenRect(nextSource, imageOffset, scale));
  };

  const beginDrag = (event: ReactPointerEvent, mode: DragMode["type"], handle?: ResizeHandle) => {
    if (!isImageLoaded) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = { x: event.clientX, y: event.clientY };
    const target = event.currentTarget;
    dragRef.current =
      mode === "image"
        ? { type: "image", start, offset: imageOffset, target }
        : mode === "crop"
          ? { type: "crop", start, crop, target }
          : { type: "resize", handle: handle ?? "se", start, crop, target };
  };

  const continueDrag = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    const dx = event.clientX - drag.start.x;
    const dy = event.clientY - drag.start.y;

    if (drag.type === "image") {
      setImageOffset(clampImageOffset({ x: drag.offset.x + dx, y: drag.offset.y + dy }, crop, imageSize, scale));
      return;
    }

    if (drag.type === "crop") {
      setCrop(clampScreenRect({ ...drag.crop, x: drag.crop.x + dx, y: drag.crop.y + dy }, imageBounds));
      return;
    }

    setCrop(resizeScreenRect(drag.crop, drag.handle, dx, dy, imageBounds));
  };

  const endDrag = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if ("hasPointerCapture" in drag.target && drag.target.hasPointerCapture(event.pointerId)) {
      drag.target.releasePointerCapture(event.pointerId);
    }
  };

  const confirmCrop = async () => {
    try {
      const image = imageRef.current;
      if (!image || !isImageLoaded) return;
      const source = clampSourceRect(sourceCrop, imageSize);
      if (source.width < 1 || source.height < 1) return;

      const dataUrl = drawImageRect(image, source, source.width, source.height);
      const thumbnailScale = Math.min(1, MAX_THUMBNAIL_SIZE / Math.max(source.width, source.height));
      const thumbnailDataUrl = drawImageRect(
        image,
        source,
        Math.max(1, Math.round(source.width * thumbnailScale)),
        Math.max(1, Math.round(source.height * thumbnailScale)),
      );
      await onConfirm({
        dataUrl,
        thumbnailDataUrl,
        width: source.width,
        height: source.height,
      });
    } catch (cropError) {
      setError(`导出裁剪图片失败：${String(cropError)}`);
    }
  };

  if (!imagePath) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid bg-black/60 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={cropDialogCopy.title}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="m-auto grid h-[min(760px,calc(100vh-40px))] w-[min(1120px,calc(100vw-40px))] grid-cols-[minmax(0,1fr)_260px] overflow-hidden rounded-xl border border-border-default bg-panel-raised shadow-floating max-[860px]:grid-cols-1 max-[860px]:grid-rows-[minmax(0,1fr)_auto]">
        <div className="grid min-h-0 grid-rows-[56px_minmax(0,1fr)]">
          <header className="flex items-center justify-between border-b border-border-subtle px-5">
            <div className="text-sm font-bold text-text-primary">{cropDialogCopy.title}</div>
            <button
              className="grid h-9 w-9 place-items-center rounded-lg text-text-secondary transition hover:bg-control-hover hover:text-text-primary"
              type="button"
              onClick={onCancel}
              title={cropDialogCopy.cancel}
              aria-label={cropDialogCopy.cancel}
            >
              <X size={18} />
            </button>
          </header>

          <div
            ref={stageRef}
            className="relative m-4 min-h-0 overflow-hidden rounded-lg border border-border-subtle bg-canvas"
            onPointerMove={continueDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {!isImageLoaded && !error && (
              <div className="absolute inset-0 grid place-items-center text-sm text-text-muted">
                {cropDialogCopy.loading}
              </div>
            )}
            {error && (
              <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-danger">
                {error}
              </div>
            )}
            <img
              ref={imageRef}
              className="absolute max-w-none select-none"
              src={imageSource}
              alt=""
              draggable={false}
              onLoad={handleImageLoad}
              onError={() => setError(cropDialogCopy.empty)}
              onPointerDown={(event) => beginDrag(event, "image")}
              style={{
                left: imageOffset.x,
                top: imageOffset.y,
                width: imageBounds.width,
                height: imageBounds.height,
                cursor: isImageLoaded ? "grab" : "default",
              }}
            />

            {isImageLoaded && (
              <>
                <CropShade stageSize={stageSize} crop={crop} />
                <div
                  className="absolute border-2 border-accent shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
                  style={{
                    left: crop.x,
                    top: crop.y,
                    width: crop.width,
                    height: crop.height,
                    cursor: "move",
                  }}
                  onPointerDown={(event) => beginDrag(event, "crop")}
                >
                  <div className="pointer-events-none grid h-full w-full grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }).map((_, index) => (
                      <span key={index} className="border border-white/20" />
                    ))}
                  </div>
                  {resizeHandles.map((handle) => (
                    <button
                      key={handle.id}
                      className={[
                        "absolute h-4 w-4 rounded-sm border border-accent bg-panel-raised",
                        handle.className,
                      ].join(" ")}
                      type="button"
                      aria-label={handle.label}
                      onPointerDown={(event) => beginDrag(event, "resize", handle.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="grid border-l border-border-subtle p-5 max-[860px]:border-l-0 max-[860px]:border-t">
          <div>
            <div className="mb-4 text-sm font-bold text-text-primary">{cropDialogCopy.sizeTitle}</div>
            <label className="mb-3 block text-xs font-semibold text-text-muted">
              {cropDialogCopy.width}
              <input
                className="mt-1 h-9 w-full rounded-md border border-border-default bg-control px-3 text-sm text-text-primary outline-none transition focus:border-accent"
                type="number"
                min={1}
                max={imageSize.width || undefined}
                value={sourceCrop.width}
                onChange={(event) => updateSourceSize("width", event.target.value)}
                disabled={!isImageLoaded}
              />
            </label>
            <label className="block text-xs font-semibold text-text-muted">
              {cropDialogCopy.height}
              <input
                className="mt-1 h-9 w-full rounded-md border border-border-default bg-control px-3 text-sm text-text-primary outline-none transition focus:border-accent"
                type="number"
                min={1}
                max={imageSize.height || undefined}
                value={sourceCrop.height}
                onChange={(event) => updateSourceSize("height", event.target.value)}
                disabled={!isImageLoaded}
              />
            </label>
          </div>

          <div className="mt-auto flex justify-end gap-2">
            <button
              className="h-9 rounded-lg border border-border-default px-4 text-sm font-semibold text-text-secondary transition hover:bg-control-hover hover:text-text-primary"
              type="button"
              onClick={onCancel}
            >
              {cropDialogCopy.cancel}
            </button>
            <button
              className="h-9 rounded-lg bg-accent px-4 text-sm font-bold text-text-inverse transition hover:bg-accent-strong disabled:bg-control"
              type="button"
              onClick={() => void confirmCrop()}
              disabled={!isImageLoaded || isSaving}
            >
              {cropDialogCopy.confirm}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CropShade({ stageSize, crop }: { stageSize: { width: number; height: number }; crop: Rect }) {
  return (
    <>
      <div className="absolute left-0 top-0 bg-black/48" style={{ width: stageSize.width, height: crop.y }} />
      <div
        className="absolute left-0 bg-black/48"
        style={{ top: crop.y, width: crop.x, height: crop.height }}
      />
      <div
        className="absolute bg-black/48"
        style={{
          left: crop.x + crop.width,
          top: crop.y,
          width: Math.max(0, stageSize.width - crop.x - crop.width),
          height: crop.height,
        }}
      />
      <div
        className="absolute left-0 bg-black/48"
        style={{
          top: crop.y + crop.height,
          width: stageSize.width,
          height: Math.max(0, stageSize.height - crop.y - crop.height),
        }}
      />
    </>
  );
}

const resizeHandles: Array<{ id: ResizeHandle; label: string; className: string }> = [
  { id: "nw", label: "左上角", className: "-left-2 -top-2 cursor-nwse-resize" },
  { id: "n", label: "上边缘", className: "left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize" },
  { id: "ne", label: "右上角", className: "-right-2 -top-2 cursor-nesw-resize" },
  { id: "e", label: "右边缘", className: "-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize" },
  { id: "se", label: "右下角", className: "-bottom-2 -right-2 cursor-nwse-resize" },
  { id: "s", label: "下边缘", className: "bottom-[-8px] left-1/2 -translate-x-1/2 cursor-ns-resize" },
  { id: "sw", label: "左下角", className: "-bottom-2 -left-2 cursor-nesw-resize" },
  { id: "w", label: "左边缘", className: "-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize" },
];

function screenRectToSourceRect(rect: Rect, offset: Point, scale: number, imageSize: { width: number; height: number }): Rect {
  if (!imageSize.width || !imageSize.height) return { x: 0, y: 0, width: 1, height: 1 };
  return clampSourceRect(
    {
      x: Math.round((rect.x - offset.x) / scale),
      y: Math.round((rect.y - offset.y) / scale),
      width: Math.round(rect.width / scale),
      height: Math.round(rect.height / scale),
    },
    imageSize,
  );
}

function sourceRectToScreenRect(rect: Rect, offset: Point, scale: number): Rect {
  return {
    x: offset.x + rect.x * scale,
    y: offset.y + rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

function clampSourceRect(rect: Rect, imageSize: { width: number; height: number }): Rect {
  const width = Math.max(1, Math.min(Math.round(rect.width), imageSize.width || 1));
  const height = Math.max(1, Math.min(Math.round(rect.height), imageSize.height || 1));
  return {
    x: Math.max(0, Math.min(Math.round(rect.x), Math.max(0, imageSize.width - width))),
    y: Math.max(0, Math.min(Math.round(rect.y), Math.max(0, imageSize.height - height))),
    width,
    height,
  };
}

function clampScreenRect(rect: Rect, bounds: Rect): Rect {
  const width = Math.max(MIN_CROP_SCREEN_SIZE, Math.min(rect.width, bounds.width));
  const height = Math.max(MIN_CROP_SCREEN_SIZE, Math.min(rect.height, bounds.height));
  return {
    x: Math.max(bounds.x, Math.min(rect.x, bounds.x + bounds.width - width)),
    y: Math.max(bounds.y, Math.min(rect.y, bounds.y + bounds.height - height)),
    width,
    height,
  };
}

function resizeScreenRect(rect: Rect, handle: ResizeHandle, dx: number, dy: number, bounds: Rect): Rect {
  let next = { ...rect };
  if (handle.includes("e")) next.width = rect.width + dx;
  if (handle.includes("s")) next.height = rect.height + dy;
  if (handle.includes("w")) {
    next.x = rect.x + dx;
    next.width = rect.width - dx;
  }
  if (handle.includes("n")) {
    next.y = rect.y + dy;
    next.height = rect.height - dy;
  }

  if (next.width < MIN_CROP_SCREEN_SIZE) {
    if (handle.includes("w")) next.x -= MIN_CROP_SCREEN_SIZE - next.width;
    next.width = MIN_CROP_SCREEN_SIZE;
  }
  if (next.height < MIN_CROP_SCREEN_SIZE) {
    if (handle.includes("n")) next.y -= MIN_CROP_SCREEN_SIZE - next.height;
    next.height = MIN_CROP_SCREEN_SIZE;
  }

  if (next.x < bounds.x) {
    next.width -= bounds.x - next.x;
    next.x = bounds.x;
  }
  if (next.y < bounds.y) {
    next.height -= bounds.y - next.y;
    next.y = bounds.y;
  }
  if (next.x + next.width > bounds.x + bounds.width) {
    next.width = bounds.x + bounds.width - next.x;
  }
  if (next.y + next.height > bounds.y + bounds.height) {
    next.height = bounds.y + bounds.height - next.y;
  }

  return clampScreenRect(next, bounds);
}

function clampImageOffset(offset: Point, crop: Rect, imageSize: { width: number; height: number }, scale: number): Point {
  const displayWidth = imageSize.width * scale;
  const displayHeight = imageSize.height * scale;
  return {
    x: Math.min(crop.x, Math.max(crop.x + crop.width - displayWidth, offset.x)),
    y: Math.min(crop.y, Math.max(crop.y + crop.height - displayHeight, offset.y)),
  };
}

function drawImageRect(image: HTMLImageElement, source: Rect, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建裁剪画布");
  context.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}
