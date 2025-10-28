import React from 'react'
import { Card } from './Card'
import type { Translation } from '../../types/wagtail'

interface TranslationsCardProps {
  translations: Translation[]
}

export const TranslationsCard: React.FC<TranslationsCardProps> = ({ translations }) => {
  if (translations.length === 0) {
    return (
      <Card title="Translations">
        <p className="text-sm text-gray-500 italic">No translations available</p>
      </Card>
    )
  }

  return (
    <Card title="Translations">
      <ul className="space-y-2">
        {translations.map((translation) => (
          <li key={translation.pageId} className="flex items-center gap-3">
            <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded uppercase">
              {translation.languageCode}
            </span>
            <a
              href={translation.editUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex-1"
            >
              {translation.title}
            </a>
            <svg
              className="w-4 h-4 text-gray-400"
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
          </li>
        ))}
      </ul>
    </Card>
  )
}
