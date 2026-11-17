import React from 'react';
import { Link } from 'react-router-dom';
import { FaCheck, FaTrash } from 'react-icons/fa';
import Avatar from '../common/Avatar';
import { timeAgo, formatDateTime } from '../../utils/time';

/**
 * One notification row. `to` is null when the notification has no destination,
 * in which case the row is not a link.
 */
const NotificationItem = ({ notif, to, icon: Icon, tone, onOpen, onMarkRead, onDelete }) => {
  const unread = !notif.is_read;

  const body = (
    <>
      <span className="notif-avatar">
        <Avatar src={notif.actor_profile_picture} name={notif.actor_name} size={48} decorative />
        <span className={`notif-icon tone-${tone}`} aria-hidden="true">
          <Icon />
        </span>
      </span>
      <span className="notif-body">
        <span className="notif-text">
          <strong>{notif.actor_name}</strong> {notif.content}
        </span>
        <time className="notif-time" dateTime={notif.created_at} title={formatDateTime(notif.created_at)}>
          {timeAgo(notif.created_at)}
        </time>
      </span>
      {unread && <span className="notif-dot" role="img" aria-label="Unread" />}
    </>
  );

  return (
    <li className={`notif ${unread ? 'unread' : ''}`}>
      {to ? (
        <Link to={to} className="notif-main" onClick={() => onOpen(notif)}>
          {body}
        </Link>
      ) : (
        <div className="notif-main">{body}</div>
      )}
      <div className="notif-actions">
        {unread && (
          <button type="button" className="notif-btn" onClick={() => onMarkRead(notif.id)} aria-label="Mark as read">
            <FaCheck aria-hidden="true" />
          </button>
        )}
        <button type="button" className="notif-btn notif-btn-danger" onClick={() => onDelete(notif.id)} aria-label="Delete notification">
          <FaTrash aria-hidden="true" />
        </button>
      </div>
    </li>
  );
};

export default React.memo(NotificationItem);
