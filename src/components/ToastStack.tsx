export interface ToastMessage {
  readonly id: number;
  readonly message: string;
}

export interface ReadonlyToastStackProps {
  readonly toasts: ToastMessage[];
}

export function ToastStack({ toasts }: ReadonlyToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 grid w-[min(360px,calc(100vw-40px))] gap-2" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          className="overflow-hidden rounded-lg border border-border-default bg-panel-raised px-4 py-3 text-sm leading-5 text-text-primary shadow-floating"
          key={toast.id}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
