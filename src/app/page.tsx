// Updated: app/page.tsx
'use client';

import { useState, useEffect, useRef } from "react";
import { SourcesPanel } from "@/components/sources/SourcesPanel";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { SourceInput } from "@/components/sources/AddSourceDialog";

interface Source {
  id: string;
  name: string;
  type: string;
  size: string;
  sourceType: "file" | "url" | "text";
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
}

const Index = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const { toast } = useToast();

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef(false);

  // 🧠 Auto-scroll chat to bottom on new message
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    isCancelledRef.current = true;
    setIsStreaming(false);
  };

  // -------------------- SOURCE HANDLERS --------------------
  const handleAddSource = async (sourceInput: SourceInput) => {
    try {
      const formData = new FormData();
      if (sourceInput.type === "file" && sourceInput.content instanceof File) {
        const file = sourceInput.content;
        formData.append("file", file);
        const response = await fetch("/api/indexing", { method: "POST", body: formData });
        const data = await response.json();

        if (data.success) {
          const newSource: Source = {
            id: data.source?.id?.toString() || Math.random().toString(36).substring(7),
            name: data.source?.name || file.name,
            type: data.source?.type || file.type.split("/")[1]?.toUpperCase() || "FILE",
            size: `${(file.size / 1024).toFixed(1)} KB`,
            sourceType: "file",
          };
          setSources([...sources, newSource]);
          setMessages([]);
          toast({
            title: "Source added",
            description: `${newSource.name} indexed successfully.`,
          });
        } else throw new Error(data.error || "File upload failed");
      } else if (sourceInput.type === "url") {
        formData.append("url", sourceInput.content as string);
        const response = await fetch("/api/indexing", { method: "POST", body: formData });
        const data = await response.json();

        if (data.success) {
          const newSource: Source = {
            id: data.source?.id?.toString() || Math.random().toString(36).substring(7),
            name: data.source?.name || sourceInput.name,
            type: data.source?.type || "WEBSITE",
            size: "URL",
            sourceType: "url",
          };
          setSources([...sources, newSource]);
          setMessages([]);
          toast({
            title: "Source added",
            description: `${newSource.name} indexed successfully.`,
          });
        } else throw new Error(data.error || "Failed to add website");
      } else {
        const textContent = sourceInput.content as string;
        formData.append("text", textContent);
        const response = await fetch("/api/indexing", { method: "POST", body: formData });
        const data = await response.json();

        if (data.success) {
          const newSource: Source = {
            id: data.source?.id?.toString() || Math.random().toString(36).substring(7),
            name: data.source?.name || sourceInput.name,
            type: data.source?.type || "TEXT",
            size: `${Math.ceil(textContent.length / 1024)} KB`,
            sourceType: "text",
          };
          setSources([...sources, newSource]);
          setMessages([]);
          toast({
            title: "Source added",
            description: `${newSource.name} indexed successfully.`,
          });
        } else throw new Error(data.error || "Failed to add text");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Error adding source",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleRemoveSource = (id: string) => {
    setSources(sources.filter((s) => s.id !== id));
    setMessages([]);
    toast({ title: "Source removed", description: "Source has been removed." });
  };

  // -------------------- CHAT HANDLER --------------------
  const handleSendMessage = async (content: string) => {
    if (sources.length === 0) {
      toast({
        title: "No sources available",
        description: "Please upload documents before asking questions.",
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content };
    const loadingMessage: Message = { 
      id: crypto.randomUUID(), 
      role: "assistant", 
      content: "", 
      isLoading: true 
    };
    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();
    isCancelledRef.current = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: content, sources }),
        signal: abortControllerRef.current.signal,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Chat request failed.");

      // Remove loading message
      setMessages((prev) => prev.filter((msg) => msg.id !== loadingMessage.id));

      const responseText = result.response || "";
      const assistantMessage: Message = { id: crypto.randomUUID(), role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMessage]);

      // Simulate streaming
      let currentContent = "";
      for (let i = 0; i < responseText.length; i++) {
        if (isCancelledRef.current) {
          // Truncate the content to current state
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id ? { ...msg, content: currentContent } : msg
            )
          );
          break;
        }
        currentContent += responseText[i];
        await new Promise((resolve) => setTimeout(resolve, 20));
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? { ...msg, content: currentContent } : msg
          )
        );
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Remove loading message on abort
        setMessages((prev) => prev.filter((msg) => msg.id !== loadingMessage.id));
        toast({
          title: "Stopped",
          description: "Response generation stopped.",
        });
      } else {
        // Remove loading message on other errors
        setMessages((prev) => prev.filter((msg) => msg.id !== loadingMessage.id));
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        const errorMessage: Message = { 
          id: crypto.randomUUID(), 
          role: "assistant", 
          content: `Error: ${errMsg}` 
        };
        setMessages((prev) => [...prev, errorMessage]);
        toast({ title: "Error", description: errMsg, variant: "destructive" });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // -------------------- UI --------------------
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 🧭 Persistent Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <h1 className="text-lg font-semibold tracking-wide">RAGify</h1>
        <ThemeToggle />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 flex-shrink-0 border-r h-full overflow-hidden">
          <SourcesPanel
            sources={sources}
            onAddSource={handleAddSource}
            onRemoveSource={handleRemoveSource}
          />
        </aside>

        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
            <ChatInterface
              onSendMessage={handleSendMessage}
              messages={messages}
              isStreaming={isStreaming}
              onStop={stopStreaming}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;