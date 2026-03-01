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
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  const loadNotifications = async () => {
    try {
      const response = filter === 'unread'
        ? await notificationAPI.getUnread()
        : await notificationAPI.getAll();
      setNotifications(response.data.results || response.data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationAPI.markAsRead(notificationId);
      setNotifications(notifications.map(notif =>
        notif.id === notificationId ? { ...notif, is_read: true } : notif
      ));
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications(notifications.map(notif => ({ ...notif, is_read: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await notificationAPI.deleteNotification(notificationId);
      setNotifications(notifications.filter(notif => notif.id !== notificationId));
      toast.success('Notification deleted');
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
    } catch (error) {
      toast.error('Failed to clear notifications');
    }
  };

  const getNotificationLink = (notif) => {
    switch (notif.notification_type) {
      case 'like':
      case 'comment':
        return `/posts/${notif.reference_id}`;
      case 'follow':
        return `/profile/${notif.actor_id}`;
      case 'group_invite':
        return `/groups/${notif.reference_id}`;
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
