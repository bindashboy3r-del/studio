import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface MessageBubbleProps {
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

export function MessageBubble({ sender, text, timestamp }: MessageBubbleProps) {
  const isUser = sender === 'user';
  
  return (
    <div className={cn("flex w-full mb-3", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[85%] px-3 py-2 relative",
        isUser ? "bubble-user" : "bubble-bot"
      )}>
        <p className="text-[15px] leading-snug whitespace-pre-wrap text-black font-semibold">
          {text}
        </p>
        <div className="flex justify-end mt-1">
          <span className="text-[10px] text-gray-600 font-bold">
            {format(timestamp, 'HH:mm')}
          </span>
        </div>
      </div>
    </div>
  );
}
