
'use client';

import { useState, useEffect, useRef } from "react";
import { SourcesPanel } from "@/components/sources/SourcesPanel";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { SourceInput } from "@/components/sources/AddSourceDialog";
import { Coins, RotateCcw, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { logger } from "@/lib/logger";
import { Source, ChatMessage } from "@/types";

const Index = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [tokens, setTokens] = useState<number>(10);
  const { toast } = useToast();

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef(false);

  // Derived state for current messages
  const activeMessages = activeSourceId ? (chats[activeSourceId] || []) : [];

  // 🧠 Initialize Session
  useEffect(() => {
    let storedSessionId = localStorage.getItem("rag_session_id");
    logger.log("🔍 Initializing session. Stored ID:", storedSessionId);

    if (!storedSessionId) {
      storedSessionId = crypto.randomUUID();
      localStorage.setItem("rag_session_id", storedSessionId);
      logger.log("🆕 Generated new session ID:", storedSessionId);
    }
    setSessionId(storedSessionId);

    // Load persisted chats
    const savedChats = localStorage.getItem(`chat_history_${storedSessionId}`);
    if (savedChats) {
      try {
        setChats(JSON.parse(savedChats));
      } catch (e) {
        console.error("Failed to parse saved chats", e);
      }
    }

    fetchSessionData(storedSessionId);
  }, []);

  // 💾 Persist Chats
  useEffect(() => {
    if (sessionId && Object.keys(chats).length > 0) {
      localStorage.setItem(`chat_history_${sessionId}`, JSON.stringify(chats));
    }
  }, [chats, sessionId]);

  const fetchSessionData = async (sid: string) => {
    try {
      logger.log("📥 Fetching session data for:", sid);
      const res = await fetch("/api/session", {
        headers: { "x-session-id": sid },
      });
      const data = await res.json();
      logger.log("📊 Session data received:", data);

      if (data.tokens !== undefined) setTokens(data.tokens);
      if (data.files) {
        setSources(data.files);
        // If there are sources, set the first one as active if none is selected
        if (!activeSourceId && data.files.length > 0) {
          setActiveSourceId(data.files[0].id);
        }
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
    } catch {
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
  }, [activeMessages]);

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    isCancelledRef.current = true;
    setIsStreaming(false);
  };

  // -------------------- SOURCE HANDLERS --------------------
  const handleSourceSelect = (source: Source) => {
    setActiveSourceId(source.id);
    setMobileMenuOpen(false);
  };

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
          const newSourceId = data.source?.id?.toString() || tempId;
          setSources(prev => prev.map(s =>
            s.id === tempId ? {
              id: newSourceId,
              name: data.source?.name || file.name,
              type: data.source?.type || file.type.split("/")[1]?.toUpperCase() || "FILE",
              size: `${(file.size / 1024).toFixed(1)} KB`,
              sourceType: "file",
            } : s
          ));

          // Auto-select new source
          setActiveSourceId(newSourceId);

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
          setActiveSourceId(newSource.id);

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
          setActiveSourceId(newSource.id);

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

      // Remove chat history for this source
      setChats(prev => {
        const newChats = { ...prev };
        delete newChats[id];
        return newChats;
      });

      if (activeSourceId === id) {
        setActiveSourceId(null);
      }

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

  const updateChat = (sourceId: string, newMessages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setChats(prev => ({
      ...prev,
      [sourceId]: typeof newMessages === 'function' ? newMessages(prev[sourceId] || []) : newMessages
    }));
  };

  const handleSendMessage = async (content: string) => {
    if (!activeSourceId) {
      toast({
        title: "No source selected",
        description: "Please select a source to start chatting.",
        variant: "destructive",
      });
      return;
    }

    if (tokens <= 0) {
      toast({
        title: "🚫 Daily limit reached",
        description: "You've used all 10 free questions. Please come back tomorrow!",
        variant: "destructive",
        duration: 10000, // Show for 10 seconds
      });
      return;
    }

    const activeSource = sources.find(s => s.id === activeSourceId);
    if (!activeSource) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    const loadingMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      isLoading: true
    };

    updateChat(activeSourceId, prev => [...prev, userMessage, loadingMessage]);
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
        body: JSON.stringify({
          question: content,
          sources,
          targetSource: activeSource.name, // Pass target source name for filtering
          conversationHistory: (chats[activeSourceId] || []).map(m => ({ role: m.role, content: m.content }))
        }),
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
      updateChat(activeSourceId, prev => prev.filter((msg) => msg.id !== loadingMessage.id));

      const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };
      updateChat(activeSourceId, prev => [...prev, assistantMessage]);

      // Handle Streaming Response
      if (!response.body) throw new Error("No response body");


      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let displayedContent = "";

      // Buffer for typewriter effect
      const buffer: string[] = [];
      let isTyping = false;

      // Typewriter effect interval
      const typeWriter = setInterval(() => {
        if (buffer.length > 0) {
          const char = buffer.shift();
          if (char) {
            displayedContent += char;
            updateChat(activeSourceId, prev =>
              prev.map((msg) =>
                msg.id === assistantMessage.id ? { ...msg, content: displayedContent } : msg
              )
            );
          }
        } else if (!isTyping && !isStreaming) {
          // Stop typing if buffer is empty and streaming is done
          clearInterval(typeWriter);
        }
      }, 15); // Adjust speed here (lower = faster)

      isTyping = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          isTyping = false;
          break;
        }

        if (isCancelledRef.current) {
          await reader.cancel();
          isTyping = false;
          break;
        }

        const chunk = decoder.decode(value, { stream: true });

        // Push characters to buffer
        for (const char of chunk) {
          buffer.push(char);
        }
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Remove loading message on abort
        updateChat(activeSourceId, prev => prev.filter((msg) => msg.id !== loadingMessage.id));
        toast({
          title: "Stopped",
          description: "Response generation stopped.",
        });
      } else {
        // Remove loading message on other errors
        updateChat(activeSourceId, prev => prev.filter((msg) => msg.id !== loadingMessage.id));
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Error: ${errMsg}`
        };
        updateChat(activeSourceId, prev => [...prev, errorMessage]);
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
      <header className="flex items-center justify-between px-3 py-2 md:px-6 md:py-3 border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Hamburger Menu - Mobile Only */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <SheetHeader className="px-4 pt-4 pb-2 border-b">
                <SheetTitle>Your Sources</SheetTitle>
              </SheetHeader>
              <SourcesPanel
                sources={sources}
                activeSourceId={activeSourceId}
                onAddSource={(input) => {
                  handleAddSource(input);
                  // setMobileMenuOpen(false); // Keep open to see result or close? User preference.
                }}
                onRemoveSource={handleRemoveSource}
                onSelectSource={handleSourceSelect}
              />
            </SheetContent>
          </Sheet>

          <h1 className="text-sm md:text-lg font-semibold tracking-wide">RAGify</h1>
          <span className="hidden sm:inline text-[10px] md:text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded-full">v3.1</span>
        </div>

        <div className="flex items-center gap-1.5 md:gap-4">
          {/* Warning - Hidden on small mobile */}
          {tokens === 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-destructive/10 rounded-full border border-destructive/20">
              <span className="text-[10px] md:text-sm font-medium text-destructive">⚠️ Limit reached</span>
            </div>
          )}
          {/* Tokens */}
          <div className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-primary/10 rounded-full border border-primary/20">
            <Coins className="w-3 h-3 md:w-4 md:h-4 text-primary" />
            <span className="text-[10px] md:text-sm font-medium text-primary">{tokens}</span>
          </div>
          {/* Reset (Dev Only) */}
          {process.env.NODE_ENV === 'development' && (
            <Button variant="ghost" size="icon" className="hidden md:flex" onClick={handleResetSession} title="Reset Session (Dev Only)">
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-80 flex-shrink-0 border-r h-full overflow-hidden">
          <SourcesPanel
            sources={sources}
            activeSourceId={activeSourceId}
            onAddSource={handleAddSource}
            onRemoveSource={handleRemoveSource}
            onSelectSource={handleSourceSelect}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
            <ChatInterface
              onSendMessage={handleSendMessage}
              messages={activeMessages}
              isStreaming={isStreaming}
              isSourceSelected={!!activeSourceId}
              onStop={stopStreaming}
              onAddSource={handleAddSource}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;