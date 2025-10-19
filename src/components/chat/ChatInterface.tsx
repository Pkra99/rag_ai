import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./ChatMessage";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  onSendMessage: (message: string) => Promise<void>;
  messages: Message[];
  isStreaming: boolean;
}

export function ChatInterface({
  onSendMessage,
  messages,
  isStreaming,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const message = input.trim();
    setInput("");
    await onSendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border p-6 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              AI Assistant
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ask questions about your uploaded sources
            </p>
          </div>
          <Badge variant="secondary" className="hidden sm:flex mt-8">
            {messages.length} messages
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center px-4 py-12">
            <div className="max-w-lg space-y-6">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Ready to assist
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Upload your documents and start asking questions. I'll analyze
                  your sources and provide detailed, contextual answers.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                <div className="p-4 border border-border rounded-lg bg-card">
                  <p className="text-sm font-medium">📄 Multiple formats</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, Markdown, Text, URLs
                  </p>
                </div>
                <div className="p-4 border border-border rounded-lg bg-card">
                  <p className="text-sm font-medium">💬 Smart responses</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Context-aware answers
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
                isStreaming={
                  isStreaming &&
                  index === messages.length - 1 &&
                  message.role === "assistant"
                }
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-border p-6 bg-card/50 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents..."
              className="min-h-[80px] max-h-[200px] resize-none shadow-sm"
              disabled={isStreaming}
            />
            <Button
              type="submit"
              size="icon"
              className="h-[80px] w-[80px] flex-shrink-0 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
              disabled={!input.trim() || isStreaming}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Press{" "}
            <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-xs">
              Enter
            </kbd>{" "}
            to send,{" "}
            <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-xs">
              Shift + Enter
            </kbd>{" "}
            for new line
          </p>
        </form>
      </div>
    </div>
  );
}
