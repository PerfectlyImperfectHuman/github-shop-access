import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel?: () => void;
  /** Default destructive (e.g. delete). Use primary for neutral continues (e.g. first step of a wizard). */
  confirmVariant?: "destructive" | "primary";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = "destructive",
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-[100] bg-black/60",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 shadow-xl outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
          onOpenAutoFocus={e => e.preventDefault()}
        >
          <Dialog.Title className="font-display font-semibold text-base text-card-foreground pr-8">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
            {description}
          </Dialog.Description>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => {
                onCancel?.();
                onOpenChange(false);
              }}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition hover:opacity-90",
                confirmVariant === "destructive"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground",
              )}
              onClick={() => onConfirm()}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
