import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const ToastContext = React.createContext<{
  toasts: Array<{ id: string; message: string; type: "success" | "error" }>;
  addToast: (message: string, type?: "success" | "error") => void;
  removeToast: (id: string) => void;
} | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    // During SSR, return a safe no-op function instead of throwing
    if (typeof window === "undefined") {
      return { addToast: () => {}, removeToast: () => {}, toasts: [] };
    }
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<
    Array<{ id: string; message: string; type: "success" | "error" }>
  >([]);
  const [mounted, setMounted] = React.useState(false);

  // Ensure we only render the portal on the client after hydration
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const addToast = React.useCallback(
    (message: string, type: "success" | "error" = "success") => {
      const id = Math.random().toString(36).substr(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);
      // Auto-remove after 5 seconds for errors, 3 seconds for success
      setTimeout(
        () => {
          removeToast(id);
        },
        type === "error" ? 5000 : 3000,
      );
    },
    [],
  );

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className={cn(
                  "pointer-events-auto rounded-lg px-4 py-3 shadow-2xl transition-all duration-300 animate-slide-up max-w-md border-2",
                  toast.type === "success"
                    ? "bg-primary text-primary-foreground border-primary/20"
                    : "bg-destructive text-destructive-foreground border-destructive/20",
                )}
              >
                <div className="flex items-start gap-2">
                  {toast.type === "error" && (
                    <svg
                      className="h-5 w-5 shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                  {toast.type === "success" && (
                    <svg
                      className="h-5 w-5 shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                  <span className="flex-1">{toast.message}</span>
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
