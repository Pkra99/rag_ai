export interface Source {
  id: string;
  name: string;
  type: string;
  size: string;
  sourceType: "file" | "url" | "text";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
}
