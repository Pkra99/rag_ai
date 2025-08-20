import { FC, useState, FormEvent } from 'react';
import { SendIcon } from '../ui/Icons';

interface ChatInputProps {
    sourceCount: number;
    onSendMessage: (message: string) => void;
    isLoading: boolean;
}

const ChatInput: FC<ChatInputProps> = ({ sourceCount, onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#1e1f20] p-2 rounded-lg flex items-center border border-gray-600">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={sourceCount === 0 ? "Upload a source to get started" : "Ask a question about your sources..."}
        className="bg-transparent w-full focus:outline-none px-2"
        disabled={sourceCount === 0 || isLoading}
      />
      <span className="text-sm text-gray-400 mr-2 whitespace-nowrap">{sourceCount} sources</span>
      <button type="submit" className="bg-blue-600 hover:bg-blue-500 rounded-md p-2 disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={sourceCount === 0 || isLoading}>
        {isLoading ? <div className="w-5 h-5 border-t-2 border-white rounded-full animate-spin"></div> : <SendIcon />}
      </button>
    </form>
  );
};

export default ChatInput;
