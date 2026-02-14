import { PollCreator } from "./PollCreator";
import { ToastProvider } from "./ui/toast";

export function PollCreatorWithToast() {
  return (
    <ToastProvider>
      <PollCreator />
    </ToastProvider>
  );
}
