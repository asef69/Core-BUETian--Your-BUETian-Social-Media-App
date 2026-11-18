import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaCheck, FaCopy, FaPaperPlane, FaSearch, FaShareAlt, FaTimes } from 'react-icons/fa';
import { chatAPI, userAPI } from '../../services/apiService';
import Avatar from './Avatar';
import '../../styles/ShareModal.css';

const copyText = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for non-secure contexts / older browsers.
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(area);
  if (!ok) throw new Error('copy failed');
};

const asList = (response) => {
  const data = response?.data;
  return Array.isArray(data) ? data : data?.results || [];
};

/**
 * Share dialog: copy a link, or send it to someone in chat.
 * People are the ones you can message: recent conversations and mutual followers.
 */
const ShareModal = ({ url, title = 'Share', onClose }) => {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState({}); // person id -> 'sending' | 'sent' | 'error'
  const [errors, setErrors] = useState({}); // person id -> message
  const dialogRef = useRef(null);
  const copyTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [recentRes, mutualRes] = await Promise.all([
          chatAPI.getConversations().catch(() => ({ data: [] })),
          userAPI.getMutualFollowers().catch(() => ({ data: [] })),
        ]);
        const merged = new Map();
        asList(recentRes).forEach((item) => {
          const id = item.other_user_id || item.user_id;
          if (id) {
            merged.set(id, {
              id,
              name: item.other_user_name || item.name,
              picture: item.other_user_picture || item.profile_picture,
              hint: 'Recent chat',
            });
          }
        });
        asList(mutualRes).forEach((item) => {
          const id = item.user_id || item.id;
          if (id && !merged.has(id)) {
            merged.set(id, { id, name: item.name, picture: item.profile_picture, hint: item.department_name || 'Friend' });
          }
        });
        if (!cancelled) setPeople(Array.from(merged.values()));
      } catch (error) {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(copyTimer.current);
    };
  }, []);

  // Escape closes; focus moves into the dialog and returns to the trigger afterwards.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialogRef.current?.querySelector('button, input')?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await copyText(url);
      setCopied(true);
      setCopyFailed(false);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      setCopyFailed(true);
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: document.title, url });
    } catch (error) {
      // Dismissing the system share sheet is not an error.
    }
  };

  const handleSend = useCallback(async (person) => {
    setStatus((prev) => ({ ...prev, [person.id]: 'sending' }));
    setErrors((prev) => ({ ...prev, [person.id]: '' }));
    try {
      const text = note.trim() ? `${note.trim()}\n${url}` : url;
      await chatAPI.sendMessage({ receiver_id: person.id, content: text });
      setStatus((prev) => ({ ...prev, [person.id]: 'sent' }));
      window.dispatchEvent(new Event('counts:refresh'));
    } catch (error) {
      setStatus((prev) => ({ ...prev, [person.id]: 'error' }));
      setErrors((prev) => ({
        ...prev,
        [person.id]: error.response?.data?.error || 'Could not send. Try again.',
      }));
    }
  }, [note, url]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? people.filter((person) => (person.name || '').toLowerCase().includes(term)) : people;
  }, [people, query]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-content share-modal" role="dialog" aria-modal="true" aria-labelledby="share-modal-title" ref={dialogRef}>
        <div className="modal-header">
          <h2 id="share-modal-title">{title}</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <FaTimes aria-hidden="true" />
          </button>
        </div>

        <section className="share-section" aria-label="Copy link">
          <div className="share-link-row">
            <input
              className="share-link-input"
              type="text"
              readOnly
              value={url}
              aria-label="Link"
              onFocus={(event) => event.target.select()}
            />
            <button type="button" className={`btn ${copied ? 'btn-secondary' : 'btn-primary'} share-copy-btn`} onClick={handleCopy}>
              {copied ? <FaCheck aria-hidden="true" /> : <FaCopy aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <p className="share-note" role="status" aria-live="polite">
            {copyFailed ? 'Could not copy automatically. Select the link and copy it.' : ''}
          </p>
          {typeof navigator !== 'undefined' && navigator.share && (
            <button type="button" className="btn btn-secondary btn-sm share-native" onClick={handleNativeShare}>
              <FaShareAlt aria-hidden="true" /> Share to other apps
            </button>
          )}
        </section>

        <section className="share-section" aria-label="Send in chat">
          <h3 className="share-heading">Send in chat</h3>
          <input
            className="share-message-input"
            type="text"
            placeholder="Add a message (optional)"
            aria-label="Message to include"
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <label className="share-search">
            <FaSearch aria-hidden="true" />
            <input
              type="search"
              placeholder="Search people"
              aria-label="Search people"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          {loading ? (
            <div className="share-skeleton" aria-busy="true" aria-label="Loading people">
              {[0, 1, 2].map((i) => (
                <div className="share-skel-row" key={i}>
                  <span className="skel share-skel-avatar" />
                  <span className="skel share-skel-line" />
                </div>
              ))}
            </div>
          ) : loadFailed ? (
            <p className="share-empty" role="alert">Could not load your contacts. You can still copy the link above.</p>
          ) : visible.length === 0 ? (
            <p className="share-empty">
              {people.length === 0
                ? 'No one to message yet. Follow people who follow you back, or start a chat first.'
                : `No one matches "${query}".`}
            </p>
          ) : (
            <ul className="share-people">
              {visible.map((person) => {
                const state = status[person.id];
                let label = (
                  <>
                    <FaPaperPlane aria-hidden="true" /> Send
                  </>
                );
                if (state === 'sent') {
                  label = (
                    <>
                      <FaCheck aria-hidden="true" /> Sent
                    </>
                  );
                } else if (state === 'sending') {
                  label = 'Sending...';
                } else if (state === 'error') {
                  label = 'Retry';
                }
                return (
                  <li key={person.id} className="share-person">
                    <Avatar src={person.picture} name={person.name} size={40} decorative />
                    <span className="share-person-text">
                      <strong>{person.name}</strong>
                      <span>{errors[person.id] || person.hint}</span>
                    </span>
                    <button
                      type="button"
                      className={`btn btn-sm ${state === 'sent' ? 'btn-secondary' : 'btn-primary'}`}
                      disabled={state === 'sending' || state === 'sent'}
                      onClick={() => handleSend(person)}
                      aria-label={`Send to ${person.name}`}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default ShareModal;
