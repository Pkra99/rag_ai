import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  return (
    <div
      className={cn(
        "group flex gap-4 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors",
        role === "assistant" && "bg-muted/30"
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm border transition-colors",
          role === "user"
            ? "bg-primary text-primary-foreground border-primary/20"
            : "bg-background text-primary border-border"
        )}
      >
        {role === "user" ? (
          <User className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>
      <div className="flex-1 min-w-0 pt-1 space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {role === "user" ? "You" : "Assistant"}
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-pre:bg-muted prose-pre:border prose-pre:border-border">
          <ReactMarkdown>{content}</ReactMarkdown>
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-1 bg-primary animate-pulse rounded-sm" />
          )}
        </div>
      </div>
    </div>
  );
}
