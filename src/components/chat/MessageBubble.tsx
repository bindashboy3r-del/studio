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
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[80%] p-3 rounded-2xl shadow-sm relative group",
        isUser ? "message-user" : "message-bot"
      )}>
        <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">{text}</p>
        <div className={cn(
          "text-[10px] mt-1 text-right opacity-60",
          isUser ? "text-primary-foreground" : "text-muted-foreground"
        )}>
          {format(timestamp, 'HH:mm')}
        </div>
      </div>
    </div>
  );
}
