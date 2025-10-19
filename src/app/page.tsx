'use client'
import { useState } from "react";
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
}

const Index = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const { toast } = useToast();

  const handleAddSource = async (sourceInput: SourceInput) => {
    try {
      // Create FormData for the unified indexing endpoint
      const formData = new FormData();

      if (sourceInput.type === "file" && sourceInput.content instanceof File) {
        // Handle file upload
        const file = sourceInput.content;
        formData.append('file', file);

        const response = await fetch('/api/indexing/', {
          method: 'POST',
          body: formData,
        });

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
          setMessages([]); // Clear messages when new source is added
          
          toast({
            title: "Source added",
            description: `${newSource.name} has been indexed successfully. ${data.source?.documentsIndexed || 0} documents processed.`,
          });
        } else {
          throw new Error(data.error || 'Failed to upload file');
        }
      } else if (sourceInput.type === "url") {
        // Handle URL
        formData.append('url', sourceInput.content as string);

        const response = await fetch('/api/indexing/', {
          method: 'POST',
          body: formData,
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
          setMessages([]); // Clear messages when new source is added
          
          toast({
            title: "Source added",
            description: `${newSource.name} has been indexed successfully. ${data.source?.documentsIndexed || 0} documents processed.`,
          });
        } else {
          throw new Error(data.error || 'Failed to add website');
        }
      } else {
        // Handle text
        const textContent = sourceInput.content as string;
        formData.append('text', textContent);

        const response = await fetch('/api/indexing/', {
          method: 'POST',
          body: formData,
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
          setMessages([]); // Clear messages when new source is added
          
          toast({
            title: "Source added",
            description: `${newSource.name} has been indexed successfully. ${data.source?.documentsIndexed || 0} documents processed.`,
          });
        } else {
          throw new Error(data.error || 'Failed to add text');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error adding source:', errorMessage);
      toast({
        title: "Error adding source",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleRemoveSource = (id: string) => {
    setSources(sources.filter((s) => s.id !== id));
    setMessages([]); // Clear messages when source is removed
    toast({
      title: "Source removed",
      description: "The document has been removed from sources.",
    });
  };

  const handleSendMessage = async (content: string) => {
    if (sources.length === 0) {
      toast({
        title: "No sources available",
        description: "Please upload documents before asking questions.",
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: content, 
          sources: sources.map(s => ({ 
            id: s.id, 
            name: s.name, 
            type: s.type 
          }))
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get a response from the AI.");
      }

      const result = await response.json();
      
      // Handle the response from your chat API
      const responseText = result.response || result.text || "No response received.";
      
      // Simulate character-by-character streaming for better UX
      let currentContent = "";
      const assistantMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Stream the response character by character
      for (let i = 0; i < responseText.length; i++) {
        currentContent += responseText[i];
        await new Promise((resolve) => setTimeout(resolve, 20));
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? { ...msg, content: currentContent }
              : msg
          )
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const assistantMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: "assistant",
        content: `Error: ${errorMessage}`,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="w-80 flex-shrink-0">
        <SourcesPanel
          sources={sources}
          onAddSource={handleAddSource}
          onRemoveSource={handleRemoveSource}
        />
      </div>
      <div className="flex-1">
        <ChatInterface
          onSendMessage={handleSendMessage}
          messages={messages}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
};

export default Index;