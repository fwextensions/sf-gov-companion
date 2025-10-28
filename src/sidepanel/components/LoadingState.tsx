import React from 'react'

export const LoadingState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8">
      <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
      <p className="text-gray-600 text-sm">Loading page information...</p>
    </div>
  )
}
