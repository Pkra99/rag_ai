import { FC } from 'react';
import { Source, Message } from '../../types';
import { FilterIcon, UploadIcon } from '../ui/Icons';
import ChatInput from './ChatInput';

interface ChatPanelProps {
  sources: Source[];
  messages: Message[];
  isLoading: boolean;
  openModal: () => void;
  onSendMessage: (message: string) => void;
}

const ChatPanel: FC<ChatPanelProps> = ({ sources, messages, isLoading, openModal, onSendMessage }) => (
  <section className="w-2/3 bg-[#2a2b2d] rounded-lg p-4 flex flex-col">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-lg font-semibold">Chat</h2>
      <FilterIcon />
    </div>
    <div className="flex-grow flex flex-col justify-center text-center overflow-y-auto">
      {sources.length === 0 ? (
        <>
          <UploadIcon />
          <h3 className="text-xl font-semibold mt-4">Add a source to get started</h3>
          <button onClick={openModal} className="mt-4 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md">
            Upload a source
          </button>
        </>
      ) : (
         <div className="flex-grow w-full text-left p-2 space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xl px-4 py-2 rounded-lg ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'}`}>
                  <p>{msg.text}</p>
                </div>
              </div>
            ))}
            {isLoading && messages.length > 0 && messages[messages.length - 1].sender === 'user' && (
                <div className="flex justify-start">
                    <div className="max-w-xl px-4 py-2 rounded-lg bg-gray-600 text-white">
                        <p>Thinking...</p>
                    </div>
                </div>
            )}
         </div>
      )}
    </div>
    <div className="mt-auto">
      <ChatInput sourceCount={sources.length} onSendMessage={onSendMessage} isLoading={isLoading} />
    </div>
  </section>
);

export default ChatPanel;