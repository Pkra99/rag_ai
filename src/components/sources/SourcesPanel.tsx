import { FileText, X, Globe, Type, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AddSourceDialog, SourceInput } from "./AddSourceDialog";
import { Badge } from "@/components/ui/badge";

interface Source {
  id: string;
  name: string;
  type: string;
  size: string;
  sourceType: "file" | "url" | "text";
}

interface SourcesPanelProps {
  sources: Source[];
  onAddSource: (source: SourceInput) => void;
  onRemoveSource: (id: string) => void;
}

export function SourcesPanel({ sources, onAddSource, onRemoveSource }: SourcesPanelProps) {
  (sourceType: "file" | "url" | "text") => {
    switch (sourceType) {
      case "url":
        return <Globe className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />;
      case "text":
        return <Type className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />;
      default:
        return <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-card/30 backdrop-blur-sm border-r border-border">
      <div className="p-6 border-b border-border bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">Sources</h2>
            <p className="text-xs text-muted-foreground">
              {sources.length} {sources.length === 1 ? 'document' : 'documents'}
            </p>
          </div>
        </div>
        <AddSourceDialog onAddSource={onAddSource} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {sources.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-2xl flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">No sources yet</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Add documents to build your knowledge base
                </p>
              </div>
            </div>
          ) : (
            sources.map((source) => (
              <Card
                key={source.id}
                className="p-4 hover:shadow-md hover:border-primary/20 transition-all group cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                    {source.sourceType === "url" && <Globe className="w-4 h-4 text-primary" />}
                    {source.sourceType === "text" && <Type className="w-4 h-4 text-primary" />}
                    {source.sourceType === "file" && <FileText className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1 overflow-hidden pr-2">
                    <p className="text-sm font-medium truncate break-all" title={source.name}>
                      {source.name}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {source.sourceType === "file" ? "📄 File" : source.sourceType === "url" ? "🌐 Website" : "📝 Text"}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex-shrink-0">· {source.size}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0 h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSource(source.id);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}