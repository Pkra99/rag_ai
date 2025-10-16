"use client"; 

import { useState, FC } from 'react';
import { Source, Message } from '../types';
import SourcesPanel from '../components/sources/SourcesPanel';
import ChatPanel from '../components/chat/ChatPanel';
import AddSourceModal from '../components/ui/AddSourceModal';

const NotebookLMPage: FC = () => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const addSource = (source: Source) => {
    setSources(prevSources => [...prevSources, source]);
    setMessages([]); 
  };
   const handleDeleteSource = (idToDelete: number) => {
    // Filter out the source that needs to be deleted
    setSources(currentSources =>
      currentSources.filter(source => source.id !== idToDelete)
    );
    // Also clear the chat history, as the context has now changed
    setMessages([]); 
  };

  const handleSendMessage = async (question: string) => {
    const userMessage: Message = { id: Date.now(), text: question, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, sources }),
      });

      if (!response.ok) {
        throw new Error("Failed to get a response from the AI.");
      }

      const result = await response.json();
      const aiMessage: Message = { id: Date.now() + 1, text: result.text, sender: 'ai' };
      setMessages(prev => [...prev, aiMessage]);

    } catch (error: any) {
      const errorMessage: Message = { id: Date.now() + 1, text: `Error: ${error.message}`, sender: 'ai' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#1e1f20] text-gray-300 font-sans min-h-screen flex flex-col">
      <main className="flex-grow flex p-4 gap-4 overflow-hidden h-screen">
        <SourcesPanel openModal={openModal} sources={sources} onDeleteSource={handleDeleteSource} />
        <ChatPanel 
          sources={sources} 
          messages={messages}
          isLoading={isLoading}
          openModal={openModal}
          onSendMessage={handleSendMessage}
        />
      </main>
      <AddSourceModal isOpen={isModalOpen} onClose={closeModal} onAddSource={addSource} />
    </div>
  );
};

export default NotebookLMPage;
