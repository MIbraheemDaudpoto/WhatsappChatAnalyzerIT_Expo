// src/components/UploadComponent.tsx
import { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface UploadComponentProps {
  onFile: (file: File) => void;
  isLoading: boolean;
}

export function UploadComponent({ onFile, isLoading }: UploadComponentProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.txt')) {
      onFile(file);
    } else {
      alert('Please upload a .txt WhatsApp chat export');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card
        className={`w-full max-w-md p-8 text-center space-y-6 border-2 border-dashed transition-all ${
          dragActive ? 'border-green-500 bg-green-500/5' : 'border-gray-600'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <div className="flex justify-center">
          {isLoading ? (
            <Loader2 className="w-12 h-12 animate-spin text-green-500" />
          ) : (
            <Upload className="w-12 h-12 text-gray-400" />
          )}
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isLoading ? 'Analyzing chat...' : 'Upload WhatsApp Chat'}
          </h2>
          <p className="text-gray-400 text-sm">
            {isLoading
              ? 'This may take a few seconds...'
              : 'Export chat from WhatsApp → Upload .txt file'}
          </p>
        </div>

        {!isLoading && (
          <>
            <input
              type="file"
              accept=".txt"
              onChange={handleChange}
              className="hidden"
              id="chat-upload"
            />
            <label htmlFor="chat-upload">
              <Button asChild>
                <span>Choose File</span>
              </Button>
            </label>
            <p className="text-xs text-gray-500 mt-4">
              or drag and drop your <code className="bg-gray-800 px-1 rounded">chat.txt</code>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}