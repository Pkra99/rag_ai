// Updated: components/chat/ChatInterface.tsx
'use client'
import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Loader } from "lucide-react";
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
}

export function ChatInterface({ messages, isStreaming, onSendMessage }: ChatInterfaceProps) {
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

  const renderMessage = (message: Message) => {
    if (message.isLoading) {
      return (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted flex items-center gap-2">
            <Loader className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Retrieving relevant documents and thinking...</span>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`flex ${
          message.role === "user" ? "justify-end" : "justify-start"
        }`}
      >
        <div
          className={`max-w-[80%] rounded-lg px-4 py-3 ${
            message.role === "user"
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          }`}
        >
          {message.role === "assistant" ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center px-4 py-12">
            <div className="max-w-lg space-y-6">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">Ready to assist</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Upload your documents and start asking questions. I&apos;ll analyze your sources and provide detailed, contextual answers.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                <div className="p-4 border border-border rounded-lg bg-card">
                  <p className="text-sm font-medium">📄 Multiple formats</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, Markdown, Text, URLs</p>
                </div>
                <div className="p-4 border border-border rounded-lg bg-card">
                  <p className="text-sm font-medium">💬 Smart responses</p>
                  <p className="text-xs text-muted-foreground mt-1">Context-aware answers</p>
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
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents..."
              className="min-h-[60px] max-h-[200px] resize-none"
              disabled={isStreaming}
            />
            <Button
              type="submit"
              size="icon"
              className="h-[60px] w-[60px] shrink-0"
              disabled={!input.trim() || isStreaming}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}