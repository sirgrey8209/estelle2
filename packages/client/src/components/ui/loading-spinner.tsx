import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LoadingSpinnerProps {
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 추가 클래스 */
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-3',
};

/**
 * 로딩 스피너
 */
export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-primary border-t-transparent',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
