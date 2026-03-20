import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { notificationAPI, userAPI, groupAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import { toast } from 'react-toastify';
import { FaCheck, FaCheckDouble, FaTrash, FaUserCheck, FaUserTimes, FaBell } from 'react-icons/fa';
import moment from 'moment';
import '../../styles/Notifications.css';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [summary, setSummary] = useState([]);
  const [preferences, setPreferences] = useState({ email_notifications: true, push_notifications: true });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [groupInvites, setGroupInvites] = useState([]);

  const loadGroupInvites = async () => {
    try {
      const res = await groupAPI.getInvites(); 
      setGroupInvites(res.data || []);
    } catch (error) {
      console.error('Failed to load group invites');
    }
  };

  useEffect(() => {
    loadNotifications();
    loadGroupInvites();
  }, [filter]);

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  const loadNotifications = async () => {
    try {
      console.log('Loading notifications...');
      const [response, pendingRes] = await Promise.all([
        (filter === 'unread' ? notificationAPI.getUnread() : notificationAPI.getAll()).catch((error) => {
          console.error('Failed to load notifications:', error);
          return { data: [] };
        }),
        userAPI.getPendingRequests().catch(() => ({ data: [] }))
      ]);

      console.log('Notifications response:', response);
      console.log('Pending requests response:', pendingRes);

      setNotifications(response.data?.results || response.data || []);
      setPendingRequests(pendingRes.data || []);

      // Load optional data that might not be available
      try {
        const summaryRes = await notificationAPI.getSummary().catch(() => ({ data: [] }));
        setSummary(Array.isArray(summaryRes.data) ? summaryRes.data : summaryRes.data?.results || []);
      } catch (error) {
        console.warn('Summary not available:', error);
        setSummary([]);
      }

      try {
        const preferencesRes = await notificationAPI.getPreferences().catch(() => ({ data: { email_notifications: true, push_notifications: true } }));
        setPreferences(preferencesRes.data || { email_notifications: true, push_notifications: true });
      } catch (error) {
        console.warn('Preferences not available:', error);
        setPreferences({ email_notifications: true, push_notifications: true });
      }

    } catch (error) {
      console.error('Error in loadNotifications:', error);
      // Set empty arrays as fallback
      setNotifications([]);
      setPendingRequests([]);
      setSummary([]);
      setPreferences({ email_notifications: true, push_notifications: true });
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
      await notificationAPI.markByType(type).catch(() => {
        console.warn('Mark by type not available');
      });
      toast.success(`${type} notifications marked as read`);
      emitCountsRefresh();
      loadNotifications();
    } catch (error) {
      console.warn('Failed to mark type as read:', error);
      toast.error('Failed to mark notifications as read');
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

  const handleAcceptFollow = async (followId) => {
    try {
      await userAPI.acceptFollow(followId);
      setPendingRequests(pendingRequests.filter(req => req.follow_id !== followId));
      toast.success('Follow request accepted!');
      emitCountsRefresh();
    } catch (error) {
      toast.error('Failed to accept follow request');
    }
  };

  const handleRejectFollow = async (followId) => {
    try {
      await userAPI.rejectFollow(followId);
      setPendingRequests(pendingRequests.filter(req => req.follow_id !== followId));
      toast.success('Follow request rejected');
      emitCountsRefresh();
    } catch (error) {
      toast.error('Failed to reject follow request');
    }
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
  const handleClearAll = async () => {
    try {
      await notificationAPI.clearAll();
      setNotifications([]);
      toast.success('All notifications cleared');
      emitCountsRefresh();
    } catch (error) {
      toast.error('Failed to clear all notifications');
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
        return `/groups/${referenceId}`;
      case 'message':
        return `/chat/${notif.actor_id}`;
      default:
        return '#';
    }
  };

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

          <div className="notifications-filter">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              Unread
            </button>
          </div>

          <div className="notifications-filter" style={{ marginTop: '10px', alignItems: 'center' }}>
            <button
              className={`filter-btn ${preferences?.email_notifications ? 'active' : ''}`}
              onClick={() => handlePreferenceToggle('email_notifications')}
            >
              Email Alerts {preferences?.email_notifications ? 'On' : 'Off'}
            </button>
            <button
              className={`filter-btn ${preferences?.push_notifications ? 'active' : ''}`}
              onClick={() => handlePreferenceToggle('push_notifications')}
            >
              Push Alerts {preferences?.push_notifications ? 'On' : 'Off'}
            </button>
          </div>

          {summary && summary.length > 0 && (
            <div className="notifications-filter" style={{ marginTop: '10px' }}>
              {summary.map((item, index) => {
                const type = item.notification_type || item.type || `type-${index}`;
                const unread = item.unread_count || 0;
                const total = item.total_count || 0;
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
              {/* Pending Follow Requests Section */}
              {pendingRequests.length > 0 && (
                <div className="pending-requests-section">
                  <h2>Follow Requests</h2>
                  <div className="pending-requests-list">
                    {pendingRequests.map((request) => (
                      <div key={request.follow_id} className="pending-request-item">
                        <Link to={`/profile/${request.follower_id}`} className="request-link">
                          <img
                            src={request.follower_picture || '/default-avatar.png'}
                            alt={request.follower_name}
                            className="request-avatar"
                          />
                          <div className="request-content">
                            <p>
                              <strong>{request.follower_name}</strong> wants to follow you
                            </p>
                            <span className="request-details">
                              {request.follower_department} • Batch {request.follower_batch}
                            </span>
                            <span className="request-time">
                              {moment.utc(request.requested_at).local().fromNow()}
                            </span>
                          </div>
                        </Link>
                        <div className="request-actions">
                          <button
                            className="action-btn accept"
                            onClick={() => handleAcceptFollow(request.follow_id)}
                            title="Accept follow request"
                          >
                            <FaUserCheck />
                          </button>
                          <button
                            className="action-btn reject"
                            onClick={() => handleRejectFollow(request.follow_id)}
                            title="Reject follow request"
                          >
                            <FaUserTimes />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Group Invitations Section */}
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

              {/* Regular Notifications Section */}
              <div className="notifications-list">
                {notifications.length === 0 ? (
                  <div className="no-notifications">
                    <FaBell className="no-notifications-icon" />
                    <p>No notifications yet</p>
                    <span>When you get notifications, they'll appear here</span>
                  </div>
                ) : (
                  notifications.map((notif) => (
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
