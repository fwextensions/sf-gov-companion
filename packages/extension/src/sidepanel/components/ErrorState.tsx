import React from 'react'
import type { ApiError } from '@sf-gov/shared'
import { Button } from "@/sidepanel/components/Button.tsx";

interface ErrorStateProps {
  error: ApiError
  onRetry?: () => void
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <p className="text-red-600 font-medium mb-2">Error</p>
      <p className="text-gray-700 text-sm mb-6 max-w-md">{error.message}</p>
      {error.retryable && onRetry && (
        <Button
          onClick={onRetry}
        >
          Retry
        </Button>
      )}
    </div>
  )
}
