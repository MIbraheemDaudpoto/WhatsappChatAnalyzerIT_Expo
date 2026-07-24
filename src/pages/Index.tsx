// src/pages/Index.tsx
'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { FileUploader } from '@/components/FileUploader';
import { ChatAnalytics } from '@/components/ChatAnalytics';
import { ContactFeedbackSection } from '@/components/ContactFeedbackSection';
import { ParsedChat } from '@/lib/chatParser';
import { toast } from 'sonner';

const Index = () => {
  const [chatData, setChatData] = useState<ParsedChat | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = (data: ParsedChat) => {
    setIsLoading(true);
    setTimeout(() => {
      setChatData(data);
      setIsLoading(false);
      toast.success(
        `Loaded ${data.messages.length} message${data.messages.length !== 1 ? 's' : ''} from ${data.users.length} user${data.users.length !== 1 ? 's' : ''}!`
      );
    }, 300);
  };

  const handleReset = () => {
    setChatData(null);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#ECE5DD]"> {/* WhatsApp background color */}
      {/* Header */}
      <header className="bg-[#075E54] text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-8 h-8" />
            <h1 className="text-3xl font-bold">Analyze your WhatsApp Chat in Seconds</h1>
          </div>
          <p className="mt-2 text-white/90">
            Upload your WhatsApp chat export and discover insights about your conversations
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {isLoading && !chatData ? (
          <div className="flex flex-col items-center justify-center min-h-96">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-300 rounded-full animate-spin"></div>
              <div
                className="absolute top-0 left-0 w-16 h-16 border-4 border-t-[#25D366] border-r-[#25D366] border-b-transparent border-l-transparent rounded-full animate-spin"
                style={{ animationDelay: '-0.3s' }}
              ></div>
            </div>
            <p className="mt-6 text-lg text-[#667781] animate-pulse">
              Analyzing your chat...
            </p>
          </div>
        ) : !chatData ? (
          <div className="max-w-2xl mx-auto mt-12">
            <FileUploader onFileUpload={handleFileUpload} isLoading={isLoading} />
          </div>
        ) : (
          <ChatAnalytics data={chatData} onReset={handleReset} isLoading={false} />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 py-6 border-t border-[#d1d1d1]">
        <div className="container mx-auto px-4">
          <ContactFeedbackSection />
        </div>

        <div className="bg-[#075E54] text-white shadow-lg rounded-lg p-6">
          <p className="text-center text-xl leading-relaxed mx-auto max-w-2xl">
            <strong>Instant Insights:</strong> Discover who’s texting the most messages, see peak activity times, and uncover hidden patterns in your friends’ conversation history.
          </p>
        </div>

        <div className="container text-center text-sm text-[#667781]">
          <p>Your WhatsApp chat analysis stays in your browser. Only Contact &amp; Feedback form submissions are sent to the server.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
