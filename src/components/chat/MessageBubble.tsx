
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
        "max-w-[85%] px-4 py-3 relative shadow-sm",
        isUser ? "bubble-user rounded-[20px] rounded-tr-none" : "bubble-bot rounded-[20px] rounded-tl-none"
      )}>
        <p className="text-[14px] leading-relaxed text-black font-semibold whitespace-pre-wrap">
          {text}
        </p>
        <div className="flex justify-end mt-1">
          <span className="text-[9px] text-gray-500 font-black uppercase tracking-tighter">
            {format(timestamp, 'HH:mm')}
          </span>
        </div>
      </div>
    </div>
  );
}
