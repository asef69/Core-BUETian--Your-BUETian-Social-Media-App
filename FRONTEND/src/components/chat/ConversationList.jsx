import React, { useMemo } from 'react';
import { FaSearch } from 'react-icons/fa';
import Avatar from '../common/Avatar';
import { formatListTime } from '../../utils/time';

const ListSkeleton = () => (
  <div className="chat-skel-list" aria-hidden="true">
    {Array.from({ length: 6 }).map((_, index) => (
      <div className="chat-skel-row" key={index}>
        <span className="chat-skel chat-skel-avatar" />
        <span className="chat-skel-lines">
          <span className="chat-skel chat-skel-line" style={{ width: `${55 + ((index * 13) % 30)}%` }} />
          <span className="chat-skel chat-skel-line chat-skel-line-thin" style={{ width: `${70 - ((index * 9) % 30)}%` }} />
        </span>
      </div>
    ))}
  </div>
);

const ConversationList = ({
  conversations,
  followers,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  selectedId,
  onSelect,
  loading,
  error,
  onRetry,
}) => {
  const query = search.trim().toLowerCase();

  const visible = useMemo(() => {
    const source = activeTab === 'conversations' ? conversations : followers;
    if (!query) return source;
    return source.filter((item) => String(item.name || '').toLowerCase().includes(query));
  }, [activeTab, conversations, followers, query]);

  const renderBody = () => {
    if (loading && conversations.length === 0 && activeTab === 'conversations') {
      return <ListSkeleton />;
    }

    if (error && conversations.length === 0 && activeTab === 'conversations') {
      return (
        <div className="chat-list-state" role="alert">
          <strong>Couldn't load your conversations</strong>
          <p>Check your connection and try again.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
            Try again
          </button>
        </div>
      );
    }

    if (visible.length === 0) {
      if (query) {
        return (
          <div className="chat-list-state">
            <strong>No matches for "{search.trim()}"</strong>
            <p>Check the spelling or try a different name.</p>
          </div>
        );
      }
      return activeTab === 'conversations' ? (
        <div className="chat-list-state">
          <strong>No conversations yet</strong>
          <p>Start a conversation with someone from the BUET community.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onTabChange('followers')}>
            Choose a follower
          </button>
        </div>
      ) : (
        <div className="chat-list-state">
          <strong>No followers yet</strong>
          <p>People who follow you will appear here, ready to message.</p>
        </div>
      );
    }

    return (
      <ul className="chat-list" role="list">
        {visible.map((item) => {
          const isActive = selectedId === item.id;
          const hasUnread = activeTab === 'conversations' && item.unread_count > 0;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`chat-list-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelect(item.id)}
                aria-current={isActive ? 'true' : undefined}
              >
                <Avatar src={item.profile_picture} name={item.name} size={48} decorative />
                <span className="chat-list-main">
                  <span className="chat-list-top">
                    <span className="chat-list-name">{item.name}</span>
                    {activeTab === 'conversations' && (
                      <span className={`chat-list-time ${hasUnread ? 'unread' : ''}`}>
                        {formatListTime(item.last_message_time)}
                      </span>
                    )}
                  </span>
                  <span className="chat-list-bottom">
                    <span className={`chat-list-preview ${hasUnread ? 'unread' : ''}`}>
                      {activeTab === 'conversations' ? item.last_message : 'Start a chat'}
                    </span>
                    {hasUnread && (
                      <span className="chat-unread-badge" aria-label={`${item.unread_count} unread messages`}>
                        {item.unread_count > 99 ? '99+' : item.unread_count}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <aside className="chat-sidebar" aria-label="Conversations">
      <div className="chat-sidebar-header">
        <h1>Messages</h1>
      </div>

      <div className="chat-search">
        <FaSearch aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={activeTab === 'conversations' ? 'Search conversations' : 'Search followers'}
          aria-label={activeTab === 'conversations' ? 'Search conversations' : 'Search followers'}
        />
      </div>

      <div className="chat-tabs" role="tablist" aria-label="Message lists">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'conversations'}
          className={activeTab === 'conversations' ? 'active' : ''}
          onClick={() => onTabChange('conversations')}
        >
          Chats
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'followers'}
          className={activeTab === 'followers' ? 'active' : ''}
          onClick={() => onTabChange('followers')}
        >
          Followers
        </button>
      </div>

      <div className="chat-sidebar-body">{renderBody()}</div>
    </aside>
  );
};

export default ConversationList;
