import React from 'react'

interface PageHeaderProps {
  title: string
  contentType: string
}

/**
 * Formats a technical content type string into a human-readable format
 * Example: "services.ServicePage" -> "Service Page"
 */
const formatContentType = (contentType: string): string => {
  // Extract the last part after the dot (e.g., "ServicePage" from "services.ServicePage")
  const typeName = contentType.split('.').pop() || contentType
  
  // Add spaces before capital letters and capitalize first letter
  return typeName
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, (str) => str.toUpperCase())
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, contentType }) => {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
        {formatContentType(contentType)}
      </span>
    </div>
  )
}
