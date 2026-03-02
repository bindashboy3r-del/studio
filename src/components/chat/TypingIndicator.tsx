import { cn } from "@/lib/utils";

export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-card text-card-foreground p-3 rounded-2xl rounded-tl-none border shadow-sm flex items-center gap-1">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}
