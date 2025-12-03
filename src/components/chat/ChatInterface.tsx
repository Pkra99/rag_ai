'use client'
import { useState, useEffect, useRef } from "react";
import { Loader, Plus, ArrowLeft } from "lucide-react";
import React from "react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  PromptInputBody,
  PromptInputMessage,
  PromptInputTools,
  PromptInputButton
} from "@/components/ai-elements/prompt-input";
import { AddSourceDialog, SourceInput } from "@/components/sources/AddSourceDialog";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { ChatMessage } from "@/types";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  isSourceSelected: boolean;
  onSendMessage: (message: string) => void;
  onStop?: () => void;
  onAddSource?: (source: SourceInput) => Promise<void>;
}

export function ChatInterface({ messages, isStreaming, isSourceSelected, onSendMessage, onStop, onAddSource }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  const handleSubmit = (message: PromptInputMessage) => {
    if (message.text.trim()) {
      onSendMessage(message.text.trim());
      setInput("");
    }
  };

  const renderMessage = (message: ChatMessage) => {
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
      <Message from={message.role}>
        <MessageContent>
          {message.role === "assistant" ? (
            <MessageResponse
              components={{
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || "");
                  return match ? (
                    <CodeBlock
                      code={String(children).replace(/\n$/, "")}
                      language={match[1] as any}
                      className="my-4"
                    />
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {showCursor ? `${message.content}▍` : message.content}
            </MessageResponse>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </MessageContent>
      </Message>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <div className="max-w-3xl mx-auto space-y-4 md:space-y-6 h-full">
          {!isSourceSelected ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 animate-in fade-in duration-500">
              <div className="max-w-md space-y-8">
                <div className="space-y-2">
                  <h1 className="text-4xl md:text-6xl font-light tracking-tighter text-foreground/80 font-serif">
                    RAG<span className="text-primary">ify</span>
                  </h1>
                  <p className="text-lg md:text-xl font-light text-muted-foreground tracking-wide">
                    Your Knowledge, <span className="italic">Amplified</span>.
                  </p>
                </div>

                <p className="text-sm text-muted-foreground/80 leading-relaxed max-w-sm mx-auto">
                  Upload your documents and start asking questions. I&apos;ll analyze your sources and provide detailed, contextual answers.
                </p>

                <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="p-4 rounded-xl bg-muted/50 border border-border/50 space-y-2">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <span>📄</span> Multiple formats
                    </div>
                    <p className="text-xs text-muted-foreground">PDF, Markdown, Text, URLs</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50 border border-border/50 space-y-2">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <span>💬</span> Smart responses
                    </div>
                    <p className="text-xs text-muted-foreground">Context-aware answers</p>
                  </div>
                </div>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-muted" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground tracking-widest">
                      Select a source to begin
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground/60">
                  <ArrowLeft className="w-4 h-4 animate-pulse" />
                  <span>Choose a document from the sidebar</span>
                </div>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="max-w-lg space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-medium tracking-tight">Conversation Initiated</h2>
                  <p className="text-muted-foreground">
                    Ask questions about this document. I&apos;ll analyze the content and provide context-aware answers.
                  </p>
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

      {/* Input Area - Only show if source is selected */}
      {isSourceSelected && (
        <div className="p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 animate-in slide-in-from-bottom-10 duration-300">
          <div className="max-w-3xl mx-auto">
            <PromptInput
              onSubmit={handleSubmit}
              className="w-full"
            >
              <PromptInputBody>
                <PromptInputTextarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  disabled={isStreaming}
                  className="min-h-[40px] max-h-[200px]"
                />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools>
                  {onAddSource && (
                    <AddSourceDialog
                      onAddSource={onAddSource}
                      trigger={
                        <PromptInputButton size="icon-sm" variant="ghost">
                          <Plus className="size-4" />
                        </PromptInputButton>
                      }
                    />
                  )}
                </PromptInputTools>
                <PromptInputSubmit
                  disabled={!input.trim() && !isStreaming}
                  status={isStreaming ? "streaming" : undefined}
                  onClick={isStreaming && onStop ? (e) => { e.preventDefault(); onStop(); } : undefined}
                />
              </PromptInputFooter>
            </PromptInput>
            <p className="hidden md:block text-xs text-muted-foreground mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </div>
  );
}