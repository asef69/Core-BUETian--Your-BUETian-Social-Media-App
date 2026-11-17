import React from 'react';
import { Link } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import Avatar from '../common/Avatar';

const ChatHeader = ({ peer, isTyping, connectionStatus, onBack }) => {
  const live = connectionStatus === 'open' || connectionStatus === 'disabled';

  let subtitle;
  if (isTyping) {
    subtitle = <span className="chat-header-typing">typing…</span>;
  } else if (!live) {
    subtitle = <span className="chat-header-muted">Reconnecting…</span>;
  } else if (peer?.id) {
    subtitle = (
      <Link to={`/profile/${peer.id}`} className="chat-header-link">
        View profile
      </Link>
    );
  }

  return (
    <header className="chat-header">
      <button type="button" className="chat-back" onClick={onBack} aria-label="Back to conversations">
        <FaArrowLeft aria-hidden="true" />
      </button>
      <Avatar src={peer?.profile_picture} name={peer?.name} size={40} decorative />
      <div className="chat-header-text">
        <h2>{peer?.name || 'Conversation'}</h2>
        <div className="chat-header-sub" aria-live="polite">{subtitle}</div>
      </div>
    </header>
  );
};

export default ChatHeader;
