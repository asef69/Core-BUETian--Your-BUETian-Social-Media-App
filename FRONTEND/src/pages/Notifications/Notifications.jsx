import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { notificationAPI, groupAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import { toast } from 'react-toastify';
import { FaBell, FaCheck, FaCheckDouble, FaTrash, FaUserCheck, FaUserTimes, FaHeart, FaComment, FaUserPlus, FaComments } from 'react-icons/fa';
import moment from 'moment';
import '../../styles/Notifications.css';
import { confirmDialog } from '../../utils/confirmDialog';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
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
      const [response, summaryRes] = await Promise.all([
        notificationAPI.getAll(),
        notificationAPI.getSummary().catch(() => ({ data: [] })),
      ]);

      setNotifications(response.data.results || response.data);
      setSummary(Array.isArray(summaryRes.data) ? summaryRes.data : summaryRes.data?.results || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
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
      setNotifications(notifications.map(notif =>
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
      setNotifications(notifications.map(notif => ({ ...notif, is_read: true })));
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
      setNotifications(notifications.filter(notif => notif.id !== notificationId));
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
      setGroupInvites(groupInvites.filter(inv => inv.group_id !== groupId));
      toast.success('Invitation accepted!');
      emitCountsRefresh();
    } catch (error) {
      toast.error('Failed to accept invitation');
    }
  };

  const handleRejectInvite = async (groupId) => {
    try {
      await groupAPI.rejectInvite(groupId);
      setGroupInvites(groupInvites.filter(inv => inv.group_id !== groupId));
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
    
    const iconProps = { size: 18, className: 'notification-type-icon' };
    
    switch (type) {
      case 'like':
      case 'blog_like':
        return <FaHeart {...iconProps} className="notification-type-icon notification-type-icon--like" />;
      case 'comment':
      case 'reply':
      case 'blog_comment':
      case 'blog_reply':
      case 'blog_comment_like':
        return <FaComment {...iconProps} className="notification-type-icon notification-type-icon--comment" />;
      case 'follow':
      case 'follow_request':
      case 'follow_accepted':
        return <FaUserPlus {...iconProps} className="notification-type-icon notification-type-icon--follow" />;
      case 'message':
        return <FaComments {...iconProps} className="notification-type-icon notification-type-icon--message" />;
      case 'group_invite':
      case 'group_join_request':
        return <FaUserCheck {...iconProps} className="notification-type-icon notification-type-icon--group" />;
      default:
        return <FaBell {...iconProps} />;
    }
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

  const normalizedSummary = useMemo(() => {
    const toInt = (value, fallback = 0) => {
      const n = Number.parseInt(value, 10);
      return Number.isFinite(n) ? n : fallback;
    };

    const raw = Array.isArray(summary) ? summary : [];
    const typedRows = raw
      .map((item) => {
        const type = item?.notification_type || item?.type;
        if (!type || typeof type !== 'string') return null;
        const total = toInt(item?.total_count, 0);
        const unread = toInt(item?.unread_count, 0);
        const read = Math.max(0, total - unread);
        return { type, total, unread, read };
      })
      .filter(Boolean);

    if (typedRows.length > 0) return typedRows;

    const counts = new Map();
    for (const notif of Array.isArray(notifications) ? notifications : []) {
      const type = notif?.notification_type || notif?.type;
      if (!type || typeof type !== 'string') continue;
      if (!counts.has(type)) {
        counts.set(type, { type, total: 0, unread: 0, read: 0 });
      }
      const row = counts.get(type);
      row.total += 1;
      if (notif?.is_read) {
        row.read += 1;
      } else {
        row.unread += 1;
      }
    }

    return Array.from(counts.values()).sort((a, b) => b.total - a.total);
  }, [summary, notifications]);

  const summaryTotals = useMemo(() => {
    const totals = normalizedSummary.reduce(
      (acc, row) => {
        acc.total += row.total;
        acc.unread += row.unread;
        acc.read += row.read;
        return acc;
      },
      { total: 0, unread: 0, read: 0 }
    );

    return {
      ...totals,
      types: normalizedSummary.length,
    };
  }, [normalizedSummary]);

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container">
          <div className="notifications-header">
            <h1>Notifications</h1>
            <div className="notifications-actions">
              <button className="btn btn-secondary" onClick={handleMarkAllRead}>
                <FaCheckDouble /> Mark All Read
              </button>
              <button className="btn btn-danger" onClick={handleClearAll}>
                <FaTrash /> Clear All
              </button>
            </div>
          </div>

          {normalizedSummary.length > 0 && (
            <div className="notifications-filter">
              <div style={{ marginBottom: '10px', fontWeight: 600 }}>
                Overall: {summaryTotals.unread}/{summaryTotals.total}
              </div>
            </div>
          )}

          {normalizedSummary.length > 0 && (
            <div className="notifications-filter notifications-filter-row">
              {normalizedSummary.map((item, index) => {
                const type = item.type;
                const unread = item.unread;
                const total = item.total;
                return (
                  <button key={`${type}-${index}`} className="filter-btn" onClick={() => handleMarkTypeRead(type)}>
                    {type}: {unread}/{total}
                  </button>
                );
              })}
            </div>
          )}

          {loading ? (
            <div className="loading">Loading notifications...</div>
          ) : (
            <>
              {groupInvites.length > 0 && (
                <div className="pending-requests-section">
                  <h2>Group Invitations</h2>
                  <div className="pending-requests-list">
                    {groupInvites.map((invite) => (
                      <div key={invite.group_id} className="pending-request-item">
                        <Link to={`/groups/${invite.group_id}/nonmember`} className="request-link">
                          <img
                            src={invite.group_cover || '/default-group.png'}
                            alt={invite.group_name}
                            className="request-avatar"
                          />
                          <div className="request-content">
                            <p>
                              You were invited to <strong>{invite.group_name}</strong>
                            </p>
                            <span className="request-time">
                              {moment.utc(invite.invited_at).local().fromNow()}
                            </span>
                          </div>
                        </Link>
                        <div className="request-actions">
                          <button
                            className="action-btn accept"
                            onClick={() => handleAcceptInvite(invite.group_id)}
                            title="Accept invitation"
                          >
                            <FaUserCheck />
                          </button>
                          <button
                            className="action-btn reject"
                            onClick={() => handleRejectInvite(invite.group_id)}
                            title="Reject invitation"
                          >
                            <FaUserTimes />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="notifications-list">
                {visibleNotifications.length === 0 ? (
                  <div className="no-notifications">
                    <FaBell className="no-notifications-icon" />
                    <p>No notifications yet</p>
                    <span>When you get notifications, they'll appear here</span>
                  </div>
                ) : (
                  visibleNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
                    >
                      <Link to={getNotificationLink(notif)} className="notification-link">
                        <img
                          src={notif.actor_profile_picture || '/default-avatar.png'}
                          alt={notif.actor_name}
                          className="notification-avatar"
                        />
                        <div className="notification-content">
                          <p>
                            {getNotificationIcon(notif)}
                            <strong>{notif.actor_name}</strong> {notif.content}
                          </p>
                          <span className="notification-time">
                            {moment.utc(notif.created_at).local().fromNow()}
                          </span>
                        </div>
                      </Link>
                      <div className="notification-actions">
                        {!notif.is_read && (
                          <button
                            className="action-btn"
                            onClick={() => handleMarkAsRead(notif.id)}
                            title="Mark as read"
                          >
                            <FaCheck />
                          </button>
                        )}
                        <button
                          className="action-btn delete"
                          onClick={() => handleDelete(notif.id)}
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
