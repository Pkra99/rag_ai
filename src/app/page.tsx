// Updated: app/page.tsx
'use client';

import { useState, useEffect, useRef } from "react";
import { SourcesPanel } from "@/components/sources/SourcesPanel";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { SourceInput } from "@/components/sources/AddSourceDialog";
import { Coins, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [sessionId, setSessionId] = useState<string>("");
  const [tokens, setTokens] = useState<number>(10);
  const { toast } = useToast();

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef(false);

  // 🧠 Initialize Session
  useEffect(() => {
    let storedSessionId = localStorage.getItem("rag_session_id");
    if (!storedSessionId) {
      storedSessionId = crypto.randomUUID();
      localStorage.setItem("rag_session_id", storedSessionId);
    }
    setSessionId(storedSessionId);

    fetchSessionData(storedSessionId);
  }, []);

  const fetchSessionData = async (sid: string) => {
    try {
      const res = await fetch("/api/session", {
        headers: { "x-session-id": sid },
      });
      const data = await res.json();
      if (data.tokens !== undefined) setTokens(data.tokens);
      if (data.files) {
        setSources(data.files);
      }
    } catch (error) {
      console.error("Failed to fetch session data:", error);
    }
  };

  const handleResetSession = async () => {
    if (!sessionId) return;
    try {
      await fetch("/api/session", {
        method: "DELETE",
        headers: { "x-session-id": sessionId },
      });
      localStorage.removeItem("rag_session_id");
      window.location.reload();
    } catch (error) {
      toast({ title: "Error", description: "Failed to reset session", variant: "destructive" });
    }
  };

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
    const currentSessionId = localStorage.getItem("rag_session_id");
    if (!currentSessionId) {
      toast({ title: "Error", description: "Session ID missing. Please refresh.", variant: "destructive" });
      return;
    }

    try {
      const formData = new FormData();
      if (sourceInput.type === "file" && sourceInput.content instanceof File) {
        const file = sourceInput.content;

        // Optimistic update: Add to UI immediately
        const tempId = `temp-${Date.now()}`;
        const tempSource: Source = {
          id: tempId,
          name: file.name,
          type: "Processing...",
          size: `${(file.size / 1024).toFixed(1)} KB`,
          sourceType: "file",
        };
        setSources([...sources, tempSource]);

        formData.append("file", file);
        const response = await fetch(`/api/indexing?sessionId=${currentSessionId}`, {
          method: "POST",
          body: formData,
          headers: { "x-session-id": currentSessionId }
        });
        const data = await response.json();

        if (data.success) {
          // Replace temp source with real data
          setSources(prev => prev.map(s =>
            s.id === tempId ? {
              id: data.source?.id?.toString() || tempId,
              name: data.source?.name || file.name,
              type: data.source?.type || file.type.split("/")[1]?.toUpperCase() || "FILE",
              size: `${(file.size / 1024).toFixed(1)} KB`,
              sourceType: "file",
            } : s
          ));
          setMessages([]);
          toast({
            title: "Source added",
            description: `${file.name} indexed successfully.`,
          });
        } else throw new Error(data.error || "File upload failed");
      } else if (sourceInput.type === "url") {
        formData.append("url", sourceInput.content as string);
        const response = await fetch(`/api/indexing?sessionId=${currentSessionId}`, {
          method: "POST",
          body: formData,
          headers: { "x-session-id": currentSessionId }
        });
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
        const response = await fetch(`/api/indexing?sessionId=${currentSessionId}`, {
          method: "POST",
          body: formData,
          headers: { "x-session-id": currentSessionId }
        });

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

  const handleRemoveSource = async (id: string) => {
    const source = sources.find((s) => s.id === id);
    if (!source) return;

    try {
      // Call DELETE API to remove embeddings
      const currentSessionId = localStorage.getItem("rag_session_id") || sessionId;
      const response = await fetch(`/api/indexing?fileName=${encodeURIComponent(source.name)}&sessionId=${currentSessionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete embeddings");
      }

      // Remove from UI immediately
      setSources(sources.filter((s) => s.id !== id));
      setMessages([]);

      // Refetch session data to sync with Redis
      await fetchSessionData(currentSessionId);

      toast({ title: "Source removed", description: `${source.name} and its embeddings have been deleted.` });
    } catch (error) {
      console.error("Error removing source:", error);
      toast({
        title: "Error",
        description: "Failed to remove source embeddings",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async (content: string) => {
    if (tokens <= 0) {
      toast({
        title: "🚫 Daily limit reached",
        description: "You've used all 10 free questions. Please come back tomorrow!",
        variant: "destructive",
        duration: 10000, // Show for 10 seconds
      });
      return;
    }

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
    // Optimistic update
    setTokens(prev => Math.max(0, prev - 1));

    abortControllerRef.current = new AbortController();
    isCancelledRef.current = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId
        },
        body: JSON.stringify({ question: content, sources }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          setTokens(0);
          throw new Error("Daily limit reached. Please try again tomorrow.");
        }
        const result = await response.json();
        throw new Error(result.error || "Chat request failed.");
      }

      // Update tokens from header
      const remainingTokens = response.headers.get("x-remaining-tokens");
      if (remainingTokens) {
        setTokens(parseInt(remainingTokens, 10));
      }

      // Remove loading message
      setMessages((prev) => prev.filter((msg) => msg.id !== loadingMessage.id));

      const assistantMessage: Message = { id: crypto.randomUUID(), role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMessage]);

      // Handle Streaming Response
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let currentContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (isCancelledRef.current) {
          await reader.cancel();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        currentContent += chunk;

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
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-wide">RAGify</h1>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">v1.0</span>
        </div>
        <div className="flex items-center gap-4">
          {tokens === 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 rounded-full border border-destructive/20">
              <span className="text-sm font-medium text-destructive">⚠️ Daily limit reached - Come back tomorrow!</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">{tokens} tokens left</span>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <Button variant="ghost" size="icon" onClick={handleResetSession} title="Reset Session (Dev Only)">
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
          <ThemeToggle />
        </div>
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