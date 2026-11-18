import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FaArrowDown, FaRegCommentDots } from 'react-icons/fa';
import MessageBubble from './MessageBubble';
import { dhakaDayKey, formatDayLabel, toTimestamp } from '../../utils/time';

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 80;

const MessagesSkeleton = () => (
  <div className="chat-skel-thread" aria-hidden="true">
    {[62, 40, 70, 34, 55].map((width, index) => (
      <span
        key={index}
        className={`chat-skel chat-skel-bubble ${index % 2 ? 'right' : 'left'}`}
        style={{ width: `${width}%` }}
      />
    ))}
  </div>
);

const MessageList = ({ messages, currentUserId, loading, isPeerTyping, peerName, threadKey, onEditMessage, onDeleteMessage }) => {
  const scrollRef = useRef(null);
  const stickRef = useRef(true);
  const lastThreadRef = useRef(null);
  const prevCountRef = useRef(0);
  const seenIdsRef = useRef(new Set());
  const seenThreadRef = useRef(null);
  const [showJump, setShowJump] = useState(false);

  // Reset "already seen" tracking when the conversation changes so that only
  // messages arriving while the thread is open get the entrance animation.
  if (seenThreadRef.current !== threadKey) {
    seenThreadRef.current = threadKey;
    seenIdsRef.current = new Set();
  }

  const items = useMemo(() => {
    const result = [];
    let previous = null;
    messages.forEach((message) => {
      const dayKey = dhakaDayKey(message.created_at);
      if (!previous || dhakaDayKey(previous.created_at) !== dayKey) {
        result.push({ kind: 'day', key: `day-${dayKey}-${message.id}`, label: formatDayLabel(message.created_at) });
      }
      const sameSender = previous && Number(previous.sender_id) === Number(message.sender_id);
      const closeInTime =
        previous && toTimestamp(message.created_at) - toTimestamp(previous.created_at) < GROUP_WINDOW_MS;
      const sameDay = previous && dhakaDayKey(previous.created_at) === dayKey;
      result.push({
        kind: 'message',
        key: message.id,
        message,
        isGroupStart: !(sameSender && closeInTime && sameDay),
      });
      previous = message;
    });
    return result;
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    stickRef.current = nearBottom;
    if (nearBottom) setShowJump(false);
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (lastThreadRef.current !== threadKey) {
      lastThreadRef.current = threadKey;
      stickRef.current = true;
      prevCountRef.current = messages.length;
      el.scrollTop = el.scrollHeight;
      setShowJump(false);
      return;
    }

    const previousCount = prevCountRef.current;
    const grew = messages.length > previousCount;
    prevCountRef.current = messages.length;
    if (!grew && !isPeerTyping) return;

    const last = messages[messages.length - 1];
    const sentByMe = last && Number(last.sender_id) === Number(currentUserId);
    if (stickRef.current || sentByMe) {
      el.scrollTo({ top: el.scrollHeight, behavior: previousCount === 0 ? 'auto' : 'smooth' });
    } else if (grew) {
      setShowJump(true);
    }
  }, [messages, isPeerTyping, threadKey, currentUserId]);

  useEffect(() => {
    messages.forEach((message) => seenIdsRef.current.add(message.id));
  }, [messages]);

  const jumpToLatest = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    setShowJump(false);
  };

  const showSkeleton = loading && messages.length === 0;
  const isEmpty = !loading && messages.length === 0;
  const hasSeen = seenIdsRef.current.size > 0;

  return (
    <div className="chat-thread-body">
      <div
        className="chat-messages"
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${peerName || 'this person'}`}
      >
        {showSkeleton && <MessagesSkeleton />}

        {isEmpty && (
          <div className="chat-empty-thread">
            <FaRegCommentDots aria-hidden="true" />
            <strong>No messages yet</strong>
            <p>Say hello to {peerName || 'your fellow BUETian'} to start the conversation.</p>
          </div>
        )}

        {items.map((item) =>
          item.kind === 'day' ? (
            <div className="chat-day" key={item.key}>
              <span>{item.label}</span>
            </div>
          ) : (
            <MessageBubble
              key={item.key}
              message={item.message}
              isOwn={Number(item.message.sender_id) === Number(currentUserId)}
              isGroupStart={item.isGroupStart}
              isNew={hasSeen && !seenIdsRef.current.has(item.message.id)}
              onEdit={onEditMessage}
              onDelete={onDeleteMessage}
            />
          ),
        )}

        {isPeerTyping && (
          <div className="chat-msg received group-start enter">
            <div className="chat-bubble chat-typing" role="status" aria-label={`${peerName || 'They'} is typing`}>
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      {showJump && (
        <button type="button" className="chat-jump" onClick={jumpToLatest}>
          <FaArrowDown aria-hidden="true" /> New messages
        </button>
      )}
    </div>
  );
};

export default MessageList;
