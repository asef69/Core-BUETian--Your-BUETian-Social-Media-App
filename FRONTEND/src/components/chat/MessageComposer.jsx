import React, { useEffect, useRef } from 'react';
import { FaPaperPlane, FaPaperclip } from 'react-icons/fa';

const MAX_HEIGHT_PX = 128;

const MessageComposer = ({ value, onChange, onSubmit, onAttach, uploading, disabled }) => {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Grow with the content, up to a cap, then scroll.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }, [value]);

  const handleKeyDown = (event) => {
    // Enter sends, Shift+Enter inserts a new line. Ignore Enter while an IME is composing.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (value.trim()) onSubmit();
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (value.trim()) onSubmit();
  };

  const canSend = Boolean(value.trim()) && !disabled;

  return (
    <form className="chat-composer" onSubmit={handleSubmit}>
      <button
        type="button"
        className="chat-icon-btn"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
        aria-label={uploading ? 'Uploading attachment' : 'Attach a photo or video'}
      >
        {uploading ? <span className="chat-spinner" aria-hidden="true" /> : <FaPaperclip aria-hidden="true" />}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={onAttach}
        hidden
        tabIndex={-1}
      />
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a message"
        aria-label="Message"
        disabled={disabled}
        enterKeyHint="send"
      />
      <button type="submit" className="chat-send" disabled={!canSend} aria-label="Send message">
        <FaPaperPlane aria-hidden="true" />
      </button>
    </form>
  );
};

export default MessageComposer;
