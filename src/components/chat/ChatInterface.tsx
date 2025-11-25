// Updated: components/chat/ChatInterface.tsx
'use client'
import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Loader, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import React from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
}

interface ChatInterfaceProps {
  messages: Message[];
  isStreaming: boolean;
  onSendMessage: (message: string) => void;
  onStop?: () => void;
}

export function ChatInterface({ messages, isStreaming, onSendMessage, onStop }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isStreaming) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isStreaming && onStop) {
      onStop();
    } else if (input.trim()) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const renderMessage = (message: Message) => {
    if (message.isLoading) {
      return (
        <div className="flex justify-start">
          <div className="max-w-[90%] md:max-w-[80%] rounded-lg px-3 py-2 md:px-4 md:py-3 bg-muted flex items-center gap-2">
            <Loader className="w-3 h-3 md:w-4 md:h-4 animate-spin text-primary" />
            <span className="text-xs md:text-sm text-muted-foreground">Retrieving relevant documents and thinking...</span>
          </div>
        </div>
      );
    }

    const isLastMessage = message.id === messages[messages.length - 1]?.id;
    const showCursor = isStreaming && isLastMessage && message.role === "assistant";

    return (
      <div
        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"
          }`}
      >
        <div
          className={`max-w-[90%] md:max-w-[80%] rounded-lg px-3 py-2 md:px-4 md:py-3 ${message.role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
            }`}
        >
          {message.role === "assistant" ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs md:text-sm">
              <ReactMarkdown>
                {showCursor ? `${message.content}▍` : message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-xs md:text-sm whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <div className="max-w-3xl mx-auto space-y-4 md:space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center px-4 py-8 md:py-12">
              <div className="max-w-lg space-y-4 md:space-y-6">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Ready to assist</h2>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    Upload your documents and start asking questions. I&apos;ll analyze your sources and provide detailed, contextual answers.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 pt-2 md:pt-4">
                  <div className="p-3 md:p-4 border border-border rounded-lg bg-card">
                    <p className="text-xs md:text-sm font-medium">📄 Multiple formats</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">PDF, Markdown, Text, URLs</p>
                  </div>
                  <div className="p-3 md:p-4 border border-border rounded-lg bg-card">
                    <p className="text-xs md:text-sm font-medium">💬 Smart responses</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">Context-aware answers</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <React.Fragment key={message.id}>
                {renderMessage(message)}
              </React.Fragment>
            ))
          )}
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-2 md:p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              className="min-h-[44px] md:min-h-[60px] max-h-[150px] md:max-h-[200px] resize-none text-sm md:text-base py-3 md:py-4"
              disabled={isStreaming}
            />
            <Button
              type={isStreaming ? "button" : "submit"}
              size="icon"
              className="h-[44px] w-[44px] md:h-[60px] md:w-[60px] shrink-0"
              onClick={handleButtonClick}
              disabled={!input.trim() && !isStreaming}
            >
              {isStreaming ? (
                <StopCircle className="h-4 w-4 md:h-5 md:w-5 text-destructive hover:text-destructive" />
              ) : (
                <Send className="h-4 w-4 md:h-5 md:w-5" />
              )}
            </Button>
          </div>
          <p className="hidden md:block text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}