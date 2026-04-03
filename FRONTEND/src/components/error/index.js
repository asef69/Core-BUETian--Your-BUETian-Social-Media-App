/**
 * Error Components Barrel Export
 * Import all error-related components from this single file
 *
 * Usage:
 * import { ErrorBoundary, ErrorState, NotFound } from './components/error';
 * import { SkeletonLoader, EmptyPosts } from './components/error';
 * or
 * import ErrorBoundary from './components/error/ErrorBoundary';
 * import { ErrorState, NetworkErrorState } from './components/error/ErrorState';
 * import { EmptyState, EmptyPosts } from './components/error/EmptyState';
 * import { SkeletonLoader, LoadingSpinner } from './components/error/SkeletonLoader';
 */

export { default as ErrorBoundary } from './ErrorBoundary';
export { 
  default as ErrorState,
  ErrorState as ErrorStateComponent,
  NetworkErrorState,
  ValidationErrorState,
  AccessDeniedError,
  TimeoutError,
  InlineErrorMessage,
  InlineSuccessMessage,
  InlineWarningMessage,
} from './ErrorState';
export { NotFound, ServerError } from './NotFound';
export {
  default as EmptyState,
  EmptyState as EmptyStateComponent,
  EmptySearchResults,
  EmptyPosts,
  EmptyNotifications,
  EmptyMessages,
  EmptyUsers,
} from './EmptyState';
export {
  SkeletonLoader,
  LoadingSpinner,
} from './SkeletonLoader';
