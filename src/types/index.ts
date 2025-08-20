// Defines the structure for a single source item
export interface Source {
  id: number;
  name: string;
  type: string;
}

// Defines the structure for a chat message
export interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
}
