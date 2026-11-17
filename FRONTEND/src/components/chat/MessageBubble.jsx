import React from 'react';
import { FaCheck, FaCheckDouble } from 'react-icons/fa';
import { toAbsoluteMediaUrl } from '../../config';
import { formatTime } from '../../utils/time';

export const isVideoUrl = (url) => {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return ['.mp4', '.mov', '.avi', '.wmv', '.webm'].some((ext) => clean.endsWith(ext));
};

const MessageBubble = ({ message, isOwn, isGroupStart, isNew }) => {
  const mediaUrl = message.media_url ? toAbsoluteMediaUrl(message.media_url) : '';
  const video = isVideoUrl(message.media_url);

  return (
    <div
      className={[
        'chat-msg',
        isOwn ? 'sent' : 'received',
        isGroupStart ? 'group-start' : '',
        isNew ? 'enter' : '',
      ].join(' ').trim()}
    >
      <div className={`chat-bubble ${mediaUrl ? 'has-media' : ''}`}>
        {mediaUrl && (video ? (
          <video src={mediaUrl} className="chat-media" controls preload="metadata" />
        ) : (
          <a href={mediaUrl} target="_blank" rel="noreferrer" className="chat-media-link" aria-label="Open photo in a new tab">
            <img src={mediaUrl} alt="Shared photo" className="chat-media" loading="lazy" />
          </a>
        ))}
        {message.content && <p className="chat-text">{message.content}</p>}
        <span className="chat-meta">
          <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
          {isOwn && (
            <span
              className={`chat-ticks ${message.is_read ? 'read' : ''}`}
              role="img"
              aria-label={message.is_read ? 'Read' : 'Sent'}
            >
              {message.is_read ? <FaCheckDouble /> : <FaCheck />}
            </span>
          )}
        </span>
      </div>
    </div>
  );
};

export default React.memo(MessageBubble);
