import React from 'react'
import { Card } from './Card'

interface MetadataCardProps {
  partnerAgency: string | null | undefined
  contentType: string
}

export const MetadataCard: React.FC<MetadataCardProps> = ({ partnerAgency, contentType }) => {
  return (
    <Card title="Metadata">
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
        <div className="text-sm font-medium text-gray-600">Content Type:</div>
        <div className="text-sm text-gray-900">{contentType}</div>
        
        <div className="text-sm font-medium text-gray-600">Partner Agency:</div>
        <div className="text-sm text-gray-900">
          {partnerAgency || (
            <span className="text-gray-400 italic">None</span>
          )}
        </div>
      </div>
    </Card>
  )
}
