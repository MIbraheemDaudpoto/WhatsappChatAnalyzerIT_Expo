import React from 'react';

interface MediaGalleryProps {
  messages: any[];
}

export function MediaGallery({ messages }: MediaGalleryProps) {
  // Filter messages containing media filenames (like .jpg, .png, .mp4)
  const mediaMessages = messages.filter((msg) =>
    msg.text?.match(/\.(jpg|jpeg|png|gif|mp4|mov|avi)$/i)
  );

  if (mediaMessages.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-4">Shared Media</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {mediaMessages.map((msg, idx) => {
          const fileName = msg.text.match(/[^\/\\&\?]+\.(jpg|jpeg|png|gif|mp4|mov|avi)/i)?.[0];
          if (!fileName) return null;

          const filePath = `/media/${fileName}`; // Folder where media files are stored

          if (fileName.match(/\.(mp4|mov|avi)$/i)) {
            return (
              <video key={idx} controls className="rounded-lg w-full h-48 object-cover">
                <source src={filePath} type="video/mp4" />
              </video>
            );
          }

          return (
            <img
              key={idx}
              src={filePath}
              alt="Shared media"
              className="rounded-lg w-full h-48 object-cover"
            />
          );
        })}
      </div>
    </div>
  );
}
