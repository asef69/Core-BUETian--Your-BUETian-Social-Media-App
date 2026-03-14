import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { notificationAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import { toast } from 'react-toastify';
import { FaCheck, FaCheckDouble, FaTrash } from 'react-icons/fa';
import moment from 'moment';
import '../../styles/Notifications.css';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState([]);
  const [preferences, setPreferences] = useState({ email_notifications: true, push_notifications: true });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  const loadNotifications = async () => {
    try {
      const [response, summaryRes, preferencesRes] = await Promise.all([
        filter === 'unread' ? notificationAPI.getUnread() : notificationAPI.getAll(),
        notificationAPI.getSummary().catch(() => ({ data: [] })),
        notificationAPI.getPreferences().catch(() => ({ data: { email_notifications: true, push_notifications: true } })),
      ]);

      setNotifications(response.data.results || response.data);
      setSummary(Array.isArray(summaryRes.data) ? summaryRes.data : summaryRes.data?.results || []);
      setPreferences(preferencesRes.data || { email_notifications: true, push_notifications: true });
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
    if (!window.confirm('Are you sure you want to clear all notifications?')) return;

    try {
      await notificationAPI.clearAll();
      setNotifications([]);
      toast.success('All notifications cleared');
      emitCountsRefresh();
    } catch (error) {
      toast.error('Failed to clear notifications');
    }
  };

  const handlePreferenceToggle = async (key) => {
    const updated = {
      ...preferences,
      [key]: !preferences[key],
    };

    try {
      await notificationAPI.updatePreferences(updated);
      setPreferences(updated);
      toast.success('Notification preferences updated');
    } catch (error) {
      toast.error('Failed to update preferences');
    }
  };

  const getNotificationLink = (notif) => {
    const type = notif.notification_type || notif.type;
    const referenceId = notif.reference_id || notif.target_id;
    switch (type) {
      case 'like':
      case 'comment':
        return `/posts/${referenceId}`;
      case 'follow':
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
              className={`filter-btn ${preferences.email_notifications ? 'active' : ''}`}
              onClick={() => handlePreferenceToggle('email_notifications')}
            >
              Email Alerts {preferences.email_notifications ? 'On' : 'Off'}
            </button>
            <button
              className={`filter-btn ${preferences.push_notifications ? 'active' : ''}`}
              onClick={() => handlePreferenceToggle('push_notifications')}
            >
              Push Alerts {preferences.push_notifications ? 'On' : 'Off'}
            </button>
          </div>

          {summary.length > 0 && (
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
            <div className="notifications-list">
              {notifications.length === 0 ? (
                <div className="no-notifications">
                  <p>No notifications</p>
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
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
