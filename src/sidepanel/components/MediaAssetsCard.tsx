import React from 'react'
import { Card } from './Card'
import type { MediaAsset } from '../../types/wagtail'
import { EditIcon } from "@/sidepanel/components/EditIcon.tsx";

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
                <li key={image.id}>
                  <button
                    onClick={() => handleImageClick(image.id)}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-2 cursor-pointer bg-transparent border-none p-0"
                    title="Edit image on Karl"
                  >
                    <EditIcon className="h-4 w-4" aria-hidden="true" />
                    {image.title || image.filename || 'Untitled Image'}
                  </button>
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
                    {file.title || file.filename || 'Untitled File'}
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
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
