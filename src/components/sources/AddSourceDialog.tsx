import { useState } from "react";
import { FileText, Globe, Type, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

export interface SourceInput {
  type: "file" | "url" | "text";
  name: string;
  content: string | File;
}

interface AddSourceDialogProps {
  onAddSource: (source: SourceInput) => void;
  trigger?: React.ReactNode;
}

export function AddSourceDialog({ onAddSource, trigger }: AddSourceDialogProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setUploadProgress(0);
    setLoadingMessage("Uploading file...");

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Create FormData and upload
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/indexing', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();

      if (data.success) {
        setLoadingMessage("Indexing complete!");

        // Pass the source to parent component
        onAddSource({
          type: "file",
          name: file.name,
          content: file,
        });

        toast({
          title: "File uploaded successfully",
          description: `${data.source?.documentsIndexed || 0} documents indexed from ${file.name}`,
        });

        // Close dialog after short delay to show completion
        setTimeout(() => {
          setOpen(false);
          resetForm();
        }, 500);
      } else {
        throw new Error(data.error || 'Failed to upload file');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
      resetForm();
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!url.trim()) return;

    try {
      new URL(url); // Validate URL
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);
    setLoadingMessage("Fetching website content...");

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 15;
        });
      }, 300);

      const formData = new FormData();
      formData.append('url', url);

      const response = await fetch('/api/indexing/', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();

      if (data.success) {
        setLoadingMessage("Website indexed successfully!");

        const urlObj = new URL(url);
        onAddSource({
          type: "url",
          name: urlObj.hostname,
          content: url,
        });

        toast({
          title: "Website added successfully",
          description: `${data.source?.documentsIndexed || 0} documents indexed from ${urlObj.hostname}`,
        });

        setTimeout(() => {
          setOpen(false);
          resetForm();
        }, 500);
      } else {
        throw new Error(data.error || 'Failed to index website');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Failed to add website",
        description: errorMessage,
        variant: "destructive",
      });
      resetForm();
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!text.trim()) {
      toast({
        title: "Empty content",
        description: "Please enter some text content",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);
    setLoadingMessage("Processing text...");

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 20;
        });
      }, 200);

      const formData = new FormData();
      formData.append('text', text);

      const response = await fetch('/api/indexing/', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();

      if (data.success) {
        setLoadingMessage("Text indexed successfully!");

        onAddSource({
          type: "text",
          name: textTitle.trim() || "Text Document",
          content: text,
        });

        toast({
          title: "Text added successfully",
          description: `${data.source?.documentsIndexed || 0} documents indexed`,
        });

        setTimeout(() => {
          setOpen(false);
          resetForm();
        }, 500);
      } else {
        throw new Error(data.error || 'Failed to index text');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Failed to add text",
        description: errorMessage,
        variant: "destructive",
      });
      resetForm();
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setUrl("");
    setText("");
    setTextTitle("");
    setUploadProgress(0);
    setLoadingMessage("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      setOpen(newOpen);
      if (!newOpen) {
        resetForm();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
            <Upload className="w-4 h-4 mr-2" />
            Add Source
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Source</DialogTitle>
          <DialogDescription>
            Add documents from files, websites, or paste text directly
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <p className="text-sm font-medium">{loadingMessage}</p>
            </div>
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-xs text-muted-foreground">
              Please wait, this may take a moment...
            </p>
          </div>
        )}

        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="file" disabled={isLoading}>
              <FileText className="w-4 h-4 mr-2" />
              File
            </TabsTrigger>
            <TabsTrigger value="url" disabled={isLoading}>
              <Globe className="w-4 h-4 mr-2" />
              Website
            </TabsTrigger>
            <TabsTrigger value="text" disabled={isLoading}>
              <Type className="w-4 h-4 mr-2" />
              Text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Upload Document</Label>
              <p className="text-sm text-muted-foreground">
                Supported formats: PDF, TXT, MD, DOCX
              </p>
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.txt,.md,.doc,.docx,.markdown"
                onChange={handleFileUpload}
                className="cursor-pointer"
                disabled={isLoading}
              />
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url-input">Website URL</Label>
              <Input
                id="url-input"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isLoading && handleUrlSubmit()}
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={handleUrlSubmit}
              className="w-full"
              disabled={isLoading || !url.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Add Website"
              )}
            </Button>
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="text-title">Document Title</Label>
              <Input
                id="text-title"
                type="text"
                placeholder="My Notes"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text-content">Content</Label>
              <Textarea
                id="text-content"
                placeholder="Paste or type your text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[150px]"
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={handleTextSubmit}
              className="w-full"
              disabled={isLoading || !text.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Add Text"
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}