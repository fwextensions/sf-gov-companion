import React from 'react'
import { Card } from './Card'
import type { MediaAsset } from '@sf-gov/shared'
import { EditIcon } from "@/sidepanel/components/EditIcon.tsx";
import { OpenIcon } from "@/sidepanel/components/OpenIcon.tsx";

interface MediaAssetsCardProps {
  images: MediaAsset[]
  files: MediaAsset[]
}

export const MediaAssetsCard: React.FC<MediaAssetsCardProps> = ({ images, files }) => {
  const hasImages = images.length > 0
  const hasFiles = files.length > 0

  const handleImageClick = async (imageId: number) => {
    const adminUrl = `https://api.sf.gov/admin/images/${imageId}/`;
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      // navigate from within the page context to preserve history properly
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (url: string) => {
          window.location.href = url;
        },
        args: [adminUrl],
      });
    }
  };

  if (!hasImages && !hasFiles) {
    return (
      <Card title="Media Assets">
        <p className="text-sm text-gray-500 italic">No media assets available</p>
      </Card>
    )
  }

  return (
    <Card title="Media Assets">
      <div className="space-y-4">
        {/* Images Section */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Images</h3>
          {hasImages ? (
            <ul className="space-y-2">
              {images.map((image) => (
                <li key={image.id} className="flex items-start gap-2">
                  <button
                    onClick={() => handleImageClick(image.id)}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-2 cursor-pointer bg-transparent border-none p-0"
                    title="Edit image on Karl"
                  >
                    <EditIcon className="h-4 w-4" aria-hidden="true" />
                    <span className="flex flex-col items-start">
                      <span>{image.title || image.filename || 'Untitled Image'}</span>
                      {image.filename && image.title && image.title !== image.filename && (
                        <span className="text-xs text-gray-500">{image.filename}</span>
                      )}
                    </span>
                  </button>
                  <a
                    href={image.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 bg-blue-600 rounded-sm text-white opacity-70 hover:opacity-100 shrink-0 mt-0.5"
                    title="Open original image in new tab"
                  >
                    <OpenIcon className="w-4 h-4" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 italic">No images</p>
          )}
        </div>

        {/* Files Section */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Files</h3>
          {hasFiles ? (
            <ul className="space-y-2">
              {files.map((file) => (
                <li key={file.id}>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-2"
                  >
                    <span className="flex flex-col items-start">
                      <span>{file.title || file.filename || 'Untitled File'}</span>
                      {file.filename && file.title && file.title !== file.filename && (
                        <span className="text-xs text-gray-500">{file.filename}</span>
                      )}
                    </span>
                    <OpenIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 italic">No files</p>
          )}
        </div>
      </div>
    </Card>
  )
}
