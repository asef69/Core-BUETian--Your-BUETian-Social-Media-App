import React from 'react';
import { FiInbox, FiSearch, FiMessageSquare, FiUsers, FiShoppingBag, FiBell, FiFilter } from 'react-icons/fi';
import '../../styles/EmptyState.css';

const emptyStateIcons = {
  posts: FiInbox,
  search: FiSearch,
  messages: FiMessageSquare,
  users: FiUsers,
  marketplace: FiShoppingBag,
  notifications: FiBell,
  filter: FiFilter,
  default: FiInbox,
};

/**
 * GENERIC EMPTY STATE - For empty lists, searches, etc.
 */
export const EmptyState = ({
  title = 'No items found',
  description = 'Try adjusting your search or filters',
  icon = 'default',
  action = null,
  actionLabel = 'Go Back',
  actionCallback = () => window.history.back(),
  type = 'default',
}) => {
  const IconComponent = emptyStateIcons[icon] || emptyStateIcons.default;

  const getEmptyMessage = () => {
    const messages = {
      posts: {
        title: 'No posts yet',
        description: 'Start your journey by creating your first post!',
      },
      search: {
        title: 'No results found',
        description: 'Try different keywords or filters to find what you\'re looking for',
      },
      messages: {
        title: 'No conversations',
        description: 'Start a new conversation to begin messaging',
      },
      users: {
        title: 'No users found',
        description: 'Try adjusting your search criteria',
      },
      marketplace: {
        title: 'No products found',
        description: 'Check back soon for new listings',
      },
      notifications: {
        title: 'All caught up!',
        description: 'You don\'t have any new notifications',
      },
      comments: {
        title: 'No comments yet',
        description: 'Be the first to comment on this post',
      },
      followers: {
        title: 'No followers',
        description: 'Start connecting with other users',
      },
      default: {
        title,
        description,
      },
    };

    return messages[type] || messages.default;
  };

  const message = getEmptyMessage();

  return (
    <div className="empty-state-container">
      <div className="empty-state-content">
        <div className="empty-state-icon">
          <IconComponent size={64} />
        </div>

        <h2 className="empty-state-title">{message.title}</h2>
        
        <p className="empty-state-description">{message.description}</p>

        <div className="empty-state-actions">
          {action ? (
            action
          ) : (
            <button
              onClick={actionCallback}
              className="btn-empty-action"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * EMPTY SEARCH RESULTS
 */
export const EmptySearchResults = ({ query }) => (
  <EmptyState
    title={`No results for "${query}"`}
    description="Try searching with different keywords or filters"
    icon="search"
    type="search"
  />
);

/**
 * EMPTY POSTS
 */
export const EmptyPosts = ({ onCreatePost = null }) => (
  <EmptyState
    title="No posts to show"
    description="Follow more users or create your first post to get started!"
    icon="posts"
    type="posts"
    action={
      onCreatePost && (
        <button onClick={onCreatePost} className="btn-primary">
          Create First Post
        </button>
      )
    }
  />
);

/**
 * EMPTY NOTIFICATIONS
 */
export const EmptyNotifications = () => (
  <EmptyState
    title="All caught up!"
    description="You don't have any new notifications"
    icon="notifications"
    type="notifications"
  />
);

/**
 * EMPTY MESSAGES
 */
export const EmptyMessages = () => (
  <EmptyState
    title="No conversations"
    description="Start a new conversation to begin messaging"
    icon="messages"
    type="messages"
  />
);

/**
 * EMPTY USERS
 */
export const EmptyUsers = () => (
  <EmptyState
    title="No users found"
    description="Try adjusting your search or follow suggestions"
    icon="users"
    type="users"
  />
);

export default EmptyState;
