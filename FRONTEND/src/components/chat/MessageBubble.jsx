import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBan, FaCheck, FaCheckDouble, FaEllipsisV, FaPen, FaTrashAlt } from 'react-icons/fa';
import { toAbsoluteMediaUrl } from '../../config';
import { formatTime } from '../../utils/time';

export const isVideoUrl = (url) => {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return ['.mp4', '.mov', '.avi', '.wmv', '.webm'].some((ext) => clean.endsWith(ext));
};

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

// Turns links into clickable text. Links to this site (e.g. a shared post) open inside the
// app; anything else opens in a new tab.
const renderText = (text) =>
  String(text).split(URL_PATTERN).map((part, index) => {
    if (index % 2 === 0) return part;
    let target = null;
    try {
      target = new URL(part);
    } catch (error) {
      return part;
    }
    if (target.origin === window.location.origin) {
      return (
        <Link key={index} to={`${target.pathname}${target.search}${target.hash}`} className="chat-link">
          {part}
        </Link>
      );
    }
    return (
      <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="chat-link">
        {part}
      </a>
    );
  });

const MAX_LENGTH = 5000;

const MessageBubble = ({ message, isOwn, isGroupStart, isNew, onEdit, onDelete }) => {
  const deleted = Boolean(message.is_deleted);
  const mediaUrl = !deleted && message.media_url ? toAbsoluteMediaUrl(message.media_url) : '';
  const video = isVideoUrl(message.media_url);
  const canManage = isOwn && !deleted && Boolean(onEdit || onDelete);

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const menuRef = useRef(null);
  const editorRef = useRef(null);

  // Close the menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  // Focus the editor and size it to its text.
  useEffect(() => {
    const el = editorRef.current;
    if (!editing || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft, editing]);

  const startEdit = () => {
    setMenuOpen(false);
    setDraft(message.content || '');
    setEditing(true);
  };

  const cancelEdit = () => {
    if (saving) return;
    setEditing(false);
  };

  const saveEdit = async () => {
    const text = draft.trim();
    if (saving) return;
    if (text === (message.content || '').trim()) {
      setEditing(false);
      return;
    }
    if (!text && !mediaUrl) return; // an empty text message is deleted, not edited
    setSaving(true);
    const ok = await onEdit(message, text);
    setSaving(false);
    if (ok) setEditing(false);
  };

  const onEditorKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      saveEdit();
    }
  };

  return (
    <div
      className={[
        'chat-msg',
        isOwn ? 'sent' : 'received',
        isGroupStart ? 'group-start' : '',
        isNew ? 'enter' : '',
        editing ? 'editing' : '',
      ].join(' ').trim()}
    >
      {canManage && !editing && (
        <div className={`chat-msg-actions ${menuOpen ? 'open' : ''}`} ref={menuRef}>
          <button
            type="button"
            className="chat-msg-menu-btn"
            aria-label="Message options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <FaEllipsisV aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="chat-msg-menu" role="menu">
              {onEdit && (
                <button type="button" role="menuitem" onClick={startEdit}>
                  <FaPen aria-hidden="true" /> {message.content ? 'Edit' : 'Add caption'}
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(message);
                  }}
                >
                  <FaTrashAlt aria-hidden="true" /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className={`chat-bubble ${mediaUrl ? 'has-media' : ''} ${deleted ? 'is-deleted' : ''}`}>
        {deleted ? (
          <p className="chat-text chat-deleted">
            <FaBan aria-hidden="true" /> This message was deleted
          </p>
        ) : (
          <>
            {mediaUrl && (video ? (
              <video src={mediaUrl} className="chat-media" controls preload="metadata" />
            ) : (
              <a href={mediaUrl} target="_blank" rel="noreferrer" className="chat-media-link" aria-label="Open photo in a new tab">
                <img src={mediaUrl} alt="Shared photo" className="chat-media" loading="lazy" />
              </a>
            ))}

            {editing ? (
              <div className="chat-edit">
                <textarea
                  ref={editorRef}
                  value={draft}
                  maxLength={MAX_LENGTH}
                  rows={1}
                  aria-label="Edit message"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onEditorKeyDown}
                  disabled={saving}
                />
                <div className="chat-edit-actions">
                  <span>Enter to save, Esc to cancel</span>
                  <button type="button" className="chat-edit-cancel" onClick={cancelEdit} disabled={saving}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="chat-edit-save"
                    onClick={saveEdit}
                    disabled={saving || (!draft.trim() && !mediaUrl)}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              message.content && <p className="chat-text">{renderText(message.content)}</p>
            )}
          </>
        )}

        {!editing && (
          <span className="chat-meta">
            {message.edited_at && !deleted && <span className="chat-edited">edited</span>}
            <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
            {isOwn && !deleted && (
              <span
                className={`chat-ticks ${message.is_read ? 'read' : ''}`}
                role="img"
                aria-label={message.is_read ? 'Read' : 'Sent'}
              >
                {message.is_read ? <FaCheckDouble /> : <FaCheck />}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
};

export default React.memo(MessageBubble);
