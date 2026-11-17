import React, { useState, useEffect } from 'react';
import { notificationAPI, groupAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import { toast } from 'react-toastify';
import {
  FaBell, FaCheckDouble, FaTrash, FaUserCheck, FaHeart, FaComment, FaUserPlus, FaComments,
  FaExclamationCircle,
} from 'react-icons/fa';
import { Link } from 'react-router-dom';
import NotificationItem from '../../components/notifications/NotificationItem';
import GroupCover from '../../components/groups/GroupCover';
import '../../styles/Notifications.css';
import { confirmDialog } from '../../utils/confirmDialog';
import { timeAgo, dhakaDayKey } from '../../utils/time';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [groupInvites, setGroupInvites] = useState([]);

  const loadGroupInvites = async () => {
    try {
      const res = await groupAPI.getInvites(); 
      const inviteList = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
          ? res.data.results
          : [];
      setGroupInvites(inviteList);
    } catch (error) {
      console.error('Failed to load group invites');
    }
  };

  useEffect(() => {
    loadNotifications();
    loadGroupInvites();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoadError(false);
      const [response, summaryRes] = await Promise.all([
        notificationAPI.getAll(),
        notificationAPI.getSummary().catch(() => ({ data: [] })),
      ]);

      setNotifications(response.data.results || response.data);
      setSummary(Array.isArray(summaryRes.data) ? summaryRes.data : summaryRes.data?.results || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const emitCountsRefresh = () => {
    window.dispatchEvent(new Event('counts:refresh'));
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationAPI.markAsRead(notificationId);
      setNotifications((prev) => prev.map((notif) =>
        notif.id === notificationId ? { ...notif, is_read: true } : notif
      ));
      emitCountsRefresh();
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications((prev) => prev.map((notif) => ({ ...notif, is_read: true })));
      toast.success('All notifications marked as read');
      emitCountsRefresh();
      loadNotifications();
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleMarkTypeRead = async (type) => {
    try {
      await notificationAPI.markByType(type);
      toast.success(`${type} notifications marked as read`);
      emitCountsRefresh();
      loadNotifications();
    } catch (error) {
      toast.error('Failed to mark type as read');
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await notificationAPI.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
      toast.success('Notification deleted');
      emitCountsRefresh();
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  const handleClearAll = async () => {
    await confirmDialog({
      title: 'Clear Read Notifications',
      message: 'Are you sure you want to clear all read notifications?',
      confirmText: 'Clear',
      confirmLoadingText: 'Clearing...',
      danger: true,
      onConfirmAction: async () => {
        try {
          await notificationAPI.clearAll();
          setNotifications([]);
          toast.success('All notifications cleared');
          emitCountsRefresh();
        } catch (error) {
          toast.error('Failed to clear notifications');
          throw error;
        }
      },
    });
  };

  const handleAcceptInvite = async (groupId) => {
    try {
      await groupAPI.acceptInvite(groupId);
      setGroupInvites((prev) => prev.filter((inv) => inv.group_id !== groupId));
      toast.success('Invitation accepted!');
      emitCountsRefresh();
    } catch (error) {
      toast.error('Failed to accept invitation');
    }
  };

  const handleRejectInvite = async (groupId) => {
    try {
      await groupAPI.rejectInvite(groupId);
      setGroupInvites((prev) => prev.filter((inv) => inv.group_id !== groupId));
      toast.success('Invitation rejected');
      emitCountsRefresh();
    } catch (error) {
      toast.error('Failed to reject invitation');
    }
  };

  const getNotificationLink = (notif) => {
    const type = notif.notification_type || notif.type;
    const postReferenceId = Number.parseInt(notif.post_reference_id, 10);
    const referenceId = notif.reference_id || notif.target_id;
    const normalizedReferenceId = Number.parseInt(referenceId, 10);
    const content = String(notif.content || '').toLowerCase();

    const isBlogContent = content.includes('blog');

    if (
      ['blog_like', 'blog_comment', 'blog_reply', 'blog_comment_like'].includes(type)
      && Number.isFinite(normalizedReferenceId)
      && normalizedReferenceId > 0
    ) {
      return `/blogs/${normalizedReferenceId}`;
    }

    if (
      ['like', 'comment', 'reply'].includes(type)
      && isBlogContent
      && Number.isFinite(normalizedReferenceId)
      && normalizedReferenceId > 0
    ) {
      return `/blogs/${normalizedReferenceId}`;
    }

    switch (type) {
      case 'like':
      case 'comment':
      case 'reply':
        if (!Number.isFinite(postReferenceId) || postReferenceId <= 0) return '#';
        return `/posts/${postReferenceId}`;
      case 'follow':
      case 'follow_request':
      case 'follow_accepted':
        return `/profile/${notif.actor_id}`;
      case 'group_invite':
      case 'group_join_request':
        if (!Number.isFinite(normalizedReferenceId) || normalizedReferenceId <= 0) return '#';
        return `/groups/${referenceId}`;
      case 'message':
        return `/chat/${notif.actor_id}`;
      default:
        return '#';
    }
  };

  const getNotificationIcon = (notif) => {
    const type = notif?.notification_type || notif?.type;

    switch (type) {
      case 'like':
      case 'blog_like':
        return { icon: FaHeart, tone: 'like' };
      case 'comment':
      case 'reply':
      case 'blog_comment':
      case 'blog_reply':
      case 'blog_comment_like':
        return { icon: FaComment, tone: 'comment' };
      case 'follow':
      case 'follow_request':
      case 'follow_accepted':
        return { icon: FaUserPlus, tone: 'follow' };
      case 'message':
        return { icon: FaComments, tone: 'message' };
      case 'group_invite':
      case 'group_join_request':
        return { icon: FaUserCheck, tone: 'group' };
      default:
        return { icon: FaBell, tone: 'default' };
    }
  };

  const TYPE_LABELS = {
    like: 'Likes',
    blog_like: 'Blog likes',
    comment: 'Comments',
    reply: 'Replies',
    blog_comment: 'Blog comments',
    blog_reply: 'Blog replies',
    blog_comment_like: 'Comment likes',
    follow: 'Follows',
    follow_request: 'Follow requests',
    follow_accepted: 'Accepted follows',
    message: 'Messages',
    group_invite: 'Group invites',
    group_join_request: 'Join requests',
  };

  const typeLabel = (type) => TYPE_LABELS[type] || String(type).replace(/_/g, ' ');

  // Clicking a notification also marks it read.
  const handleOpen = (notif) => {
    if (!notif.is_read) handleMarkAsRead(notif.id);
  };

  const inviteGroupIds = new Set(
    (Array.isArray(groupInvites) ? groupInvites : [])
      .map((invite) => Number.parseInt(invite?.group_id, 10))
      .filter((id) => Number.isFinite(id) && id > 0)
  );

  const visibleNotifications = (Array.isArray(notifications) ? notifications : []).filter((notif) => {
    const type = notif?.notification_type || notif?.type;
    if (type !== 'group_invite') {
      return true;
    }

    const referenceId = Number.parseInt(notif?.reference_id || notif?.target_id, 10);
    return Number.isFinite(referenceId) && inviteGroupIds.has(referenceId);
  });

  const unreadCount = visibleNotifications.filter((notif) => !notif.is_read).length;
  const shown = filter === 'unread' ? visibleNotifications.filter((notif) => !notif.is_read) : visibleNotifications;

  const todayKey = dhakaDayKey(new Date());
  const groupsOfDay = [
    ['Today', shown.filter((notif) => dhakaDayKey(notif.created_at) === todayKey)],
    ['Earlier', shown.filter((notif) => dhakaDayKey(notif.created_at) !== todayKey)],
  ].filter(([, items]) => items.length > 0);

  const unreadTypes = summary.filter((item) => (item.unread_count || 0) > 0);

  const renderList = () => {
    if (loading) {
      return (
        <ul className="notif-list" aria-busy="true" aria-label="Loading notifications">
          {[0, 1, 2, 3].map((i) => (
            <li className="notif notif-skeleton" key={i} aria-hidden="true">
              <span className="skel notif-skel-avatar" />
              <span className="notif-skel-lines">
                <span className="skel notif-skel-line" style={{ width: '70%' }} />
                <span className="skel notif-skel-line" style={{ width: '30%' }} />
              </span>
            </li>
          ))}
        </ul>
      );
    }

    if (loadError) {
      return (
        <div className="state-card" role="alert">
          <FaExclamationCircle aria-hidden="true" />
          <strong>Couldn't load notifications</strong>
          <p>Check your connection and try again.</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setLoading(true);
              loadNotifications();
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    if (shown.length === 0 && groupInvites.length === 0) {
      return (
        <div className="state-card">
          <FaBell aria-hidden="true" />
          <strong>{filter === 'unread' ? "You're all caught up" : 'No notifications yet'}</strong>
          <p>
            {filter === 'unread'
              ? 'Nothing unread. New activity will show up here.'
              : "When people like, comment, follow or message you, you'll see it here."}
          </p>
        </div>
      );
    }

    return groupsOfDay.map(([label, items]) => (
      <section key={label} className="notif-group" aria-labelledby={`notif-${label}`}>
        <h2 className="notif-group-title" id={`notif-${label}`}>{label}</h2>
        <ul className="notif-list">
          {items.map((notif) => {
            const { icon, tone } = getNotificationIcon(notif);
            const link = getNotificationLink(notif);
            return (
              <NotificationItem
                key={notif.id}
                notif={notif}
                to={link === '#' ? null : link}
                icon={icon}
                tone={tone}
                onOpen={handleOpen}
                onMarkRead={handleMarkAsRead}
                onDelete={handleDelete}
              />
            );
          })}
        </ul>
      </section>
    ));
  };

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container notifications-page">
          <div className="notifications-header">
            <div>
              <h1>Notifications</h1>
              <p className="page-subtitle" aria-live="polite">
                {loading ? ' ' : unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
              </p>
            </div>
            <div className="notifications-actions">
              <button type="button" className="btn btn-secondary" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
                <FaCheckDouble aria-hidden="true" /> Mark all read
              </button>
              <button type="button" className="btn btn-secondary btn-quiet-danger" onClick={handleClearAll}>
                <FaTrash aria-hidden="true" /> Clear read
              </button>
            </div>
          </div>

          <div className="notif-filters" role="tablist" aria-label="Filter notifications">
            {[['all', 'All'], ['unread', 'Unread']].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                className={`filter-chip ${filter === id ? 'active' : ''}`}
                onClick={() => setFilter(id)}
              >
                {label}
                {id === 'unread' && unreadCount > 0 && <span className="tab-count"> {unreadCount}</span>}
              </button>
            ))}
          </div>

          {unreadTypes.length > 1 && (
            <div className="notif-types">
              <span>Mark read by type:</span>
              {unreadTypes.map((item, index) => {
                const type = item.notification_type || item.type || `type-${index}`;
                return (
                  <button key={`${type}-${index}`} type="button" className="notif-type-chip" onClick={() => handleMarkTypeRead(type)}>
                    {typeLabel(type)} <span>{item.unread_count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && !loadError && groupInvites.length > 0 && (
            <section className="notif-group" aria-labelledby="invites-title">
              <h2 className="notif-group-title" id="invites-title">Group invitations</h2>
              <ul className="invite-list">
                {groupInvites.map((invite) => (
                  <li key={invite.group_id} className="invite-card">
                    <Link to={`/groups/${invite.group_id}/nonmember`} className="invite-link">
                      <GroupCover src={invite.group_cover} seed={invite.group_id} className="invite-cover" />
                      <span className="invite-text">
                        <span>
                          You were invited to <strong>{invite.group_name}</strong>
                        </span>
                        <time className="notif-time">{timeAgo(invite.invited_at)}</time>
                      </span>
                    </Link>
                    <div className="invite-actions">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAcceptInvite(invite.group_id)}>
                        Accept
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRejectInvite(invite.group_id)}>
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {renderList()}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
