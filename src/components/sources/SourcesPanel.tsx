import { FileText, X, Globe, Type, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AddSourceDialog, SourceInput } from "./AddSourceDialog";
import { Badge } from "@/components/ui/badge";
import { Source } from "@/types";
import { cn } from "@/lib/utils";

interface SourcesPanelProps {
  sources: Source[];
  activeSourceId?: string | null;
  onAddSource: (source: SourceInput) => void;
  onRemoveSource: (id: string) => void;
  onSelectSource?: (source: Source) => void;
}

export function SourcesPanel({ sources, activeSourceId, onAddSource, onRemoveSource, onSelectSource }: SourcesPanelProps) {
  return (
    <div className="h-full flex flex-col bg-card/30 backdrop-blur-sm border-r border-border">
      <div className="p-4 md:p-6 border-b border-border bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
          <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg">
            <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base md:text-lg font-semibold tracking-tight">Sources</h2>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              {sources.length} {sources.length === 1 ? 'document' : 'documents'}
            </p>
          </div>
        </div>
        <AddSourceDialog onAddSource={onAddSource} />
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-4">
        <div className="space-y-2">
          {sources.length === 0 ? (
            <div className="text-center py-8 md:py-12 space-y-3 md:space-y-4">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto bg-muted rounded-2xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-xs md:text-sm font-medium">No sources yet</p>
                <p className="text-[10px] md:text-xs text-muted-foreground leading-relaxed">
                  Add documents to build your knowledge base
                </p>
              </div>
            </div>
          ) : (
            sources.map((source) => (
              <Card
                key={source.id}
                onClick={() => onSelectSource?.(source)}
                className={cn(
                  "p-3 md:p-4 transition-all group cursor-pointer border-transparent",
                  activeSourceId === source.id
                    ? "bg-primary/5 border-primary shadow-sm"
                    : "hover:bg-accent/50 hover:border-border"
                )}
              >
                <div className="flex items-start gap-2 md:gap-3">
                  <div className={cn(
                    "p-1.5 md:p-2 rounded-lg flex-shrink-0 transition-colors",
                    activeSourceId === source.id ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                  )}>
                    {source.sourceType === "url" && <Globe className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                    {source.sourceType === "text" && <Type className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                    {source.sourceType === "file" && <FileText className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5 md:space-y-1 overflow-hidden pr-1 md:pr-2">
                    <p className={cn(
                      "text-xs md:text-sm font-medium truncate break-all transition-colors",
                      activeSourceId === source.id ? "text-primary" : "text-foreground"
                    )} title={source.name}>
                      {source.name}
                    </p>
                    <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] md:text-xs flex-shrink-0 px-1.5 py-0 md:px-2.5 md:py-0.5 h-5 md:h-auto">
                        {source.sourceType === "file" ? "📄 File" : source.sourceType === "url" ? "🌐 Website" : "📝 Text"}
                      </Badge>
                      <span className="text-[10px] md:text-xs text-muted-foreground flex-shrink-0">· {source.size}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0 h-7 w-7 md:h-8 md:w-8 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSource(source.id);
                    }}
                  >
                    <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
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