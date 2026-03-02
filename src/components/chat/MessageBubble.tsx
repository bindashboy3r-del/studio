import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { SendHorizonal } from "lucide-react";

interface MessageBubbleProps {
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  options?: string[];
  onOptionClick?: (option: string) => void;
}

export function MessageBubble({ sender, text, timestamp, options, onOptionClick }: MessageBubbleProps) {
  const isUser = sender === 'user';
  
  return (
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[85%] px-5 py-4 relative shadow-md",
        isUser 
          ? "bubble-user rounded-[24px] rounded-tr-none bg-[#DCF8C6] dark:bg-emerald-900" 
          : "bubble-bot rounded-[24px] rounded-tl-none bg-white dark:bg-slate-800"
      )}>
        <p className="text-[14px] leading-relaxed font-bold text-black dark:text-white whitespace-pre-wrap">
          {text}
        </p>

        {options && options.length > 0 && (
          <div className="mt-4 space-y-2">
            {options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => onOptionClick?.(option)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group shadow-sm"
              >
                <div className="text-[#312ECB] group-hover:scale-110 transition-transform">
                  <SendHorizonal size={14} />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-[#312ECB] dark:text-blue-400">
                  {option}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-2 opacity-40">
          <span className="text-[9px] font-black uppercase tracking-tighter text-black dark:text-white">
            {format(timestamp, 'HH:mm')}
          </span>
        </div>
      </div>
    </div>
  );
}
