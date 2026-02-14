import { PollViewer } from "./PollViewer";
import { ToastProvider } from "./ui/toast";

interface PollViewerWithToastProps {
  pollId: string;
}

export function PollViewerWithToast({ pollId }: PollViewerWithToastProps) {
  return (
    <ToastProvider>
      <PollViewer pollId={pollId} />
    </ToastProvider>
  );
}
