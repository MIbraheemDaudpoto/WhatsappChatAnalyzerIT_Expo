// src/components/FileUploader.tsx
'use client';

import { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { parseWhatsAppChat, ParsedChat } from '@/lib/chatParser';

interface FileUploaderProps {
  onFileUpload: (data: ParsedChat) => void;  // ← ParsedChat, not string
  isLoading: boolean;
}

export function FileUploader({ onFileUpload, isLoading }: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);

  // -----------------------------------------------------------------
  // 1. HANDLE FILE + PARSE
  // -----------------------------------------------------------------
  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;

    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.txt')) {
      toast.error('Please upload a .txt file');
      return;
    }

    try {
      const text = await file.text();

      // ----> Use the **updated** parser
      const parsed = parseWhatsAppChat(text);

      if (parsed.messages.length === 0) {
        throw new Error('No valid messages found in the file.');
      }

      // Success
      onFileUpload(parsed);
      toast.success('Chat parsed successfully!');
    } catch (err: any) {
      console.error('Parse error:', err);
      toast.error(
        err.message ||
          'Failed to parse chat file. Please ensure it\'s a valid WhatsApp .txt export.'
      );
    }
  };


  return (
  <Card
    className={`
      p-8 text-center space-y-6 border-2 border-dashed transition-all
      ${dragActive ? 'border-green-500 bg-green-500/5' : 'border-border'}
    `}
    onDragOver={(e) => {
      e.preventDefault();
      setDragActive(true);
    }}
    onDragLeave={(e) => {
      e.preventDefault();
      setDragActive(false);
    }}
    onDrop={(e) => {
      e.preventDefault();
      setDragActive(false);
      handleFiles(e.dataTransfer.files);
    }}
  >
    {/* Icon / Loader */}
    <div className="flex justify-center">
      {isLoading ? (
        <Loader2 className="w-12 h-12 animate-spin text-[#25D366]" />
      ) : (
        <Upload className="w-12 h-12 text-[#075E54]" />
      )}
    </div>

    {/* Heading & Description */}
    <div>
      <h2 className="text-2xl font-bold mb-2">
        {isLoading ? 'Processing...' : 'Upload WhatsApp Chat'}
      </h2>
      <p className="text-muted-foreground">
        {isLoading
          ? 'This may take a few seconds...'
          : 'Drag & drop your exported .txt file here'}
      </p>
    </div>

    {/* File Input / Browse Button */}
    {!isLoading && (
      <>
        <input
          type="file"
          accept=".txt"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          id="file-upload"
          disabled={isLoading}
        />
        <label htmlFor="file-upload" className="w-full flex justify-center">
          <span
            className="
              cursor-pointer
              w-64
              py-3
              px-6
              rounded-lg
              bg-gradient-to-r from-[#25D366] to-[#128C7E]
              text-white
              font-semibold
              text-lg
              shadow-md
              hover:scale-105
              hover:shadow-lg
              transition
              duration-300
              ease-in-out
              flex
              items-center
              justify-center
              gap-2
            "
          >
            <Upload className="w-5 h-5 text-white" />
            Browse Files
          </span>
        </label>

        <p className="text-xs text-muted-foreground mt-4">
          Export from WhatsApp → More → Export Chat → <strong>Without Media</strong>
        </p>
      </>
    )}
  </Card>
);

}