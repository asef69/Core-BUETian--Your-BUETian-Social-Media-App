import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { chatAPI, userAPI } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';
import { toast } from 'react-toastify';
import { FaPaperPlane, FaImage, FaBars, FaTimes } from 'react-icons/fa';
import moment from 'moment';
import '../../styles/Chat.css';

const Chat = () => {
  const { userId: chatUserId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [activeList, setActiveList] = useState('conversations');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const selectedUserRef = useRef(null);
  const prefillAppliedRef = useRef(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const typingStopTimeoutRef = useRef(null);
  const typingHeartbeatRef = useRef(null);
  const peerTypingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const shouldReconnectRef = useRef(true);

  useEffect(() => {
    loadConversations();
    loadFollowers();
  }, [user?.id]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    const websocket = connectWebSocket();
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
      }
      if (typingHeartbeatRef.current) {
        clearInterval(typingHeartbeatRef.current);
      }
      if (peerTypingTimeoutRef.current) {
        clearTimeout(peerTypingTimeoutRef.current);
      }
      if (websocket && websocket.readyState < WebSocket.CLOSING) {
        websocket.close();
      }
      wsRef.current = null;
    };
  }, [user?.id]);

  const appendMessageIfNew = (message) => {
    if (!message) return;
    setMessages((prev) => {
      if (message.id && prev.some((item) => item.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });
  };

  useEffect(() => {
    if (chatUserId) {
      loadMessages(chatUserId);
    }
  }, [chatUserId]);

  useEffect(() => {
    const starterMessage = searchParams.get('message');
    if (!chatUserId || !starterMessage || prefillAppliedRef.current) return;
    setNewMessage(starterMessage);
    prefillAppliedRef.current = true;
  }, [chatUserId, searchParams]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const response = await chatAPI.getConversations();
      const items = response.data.results || response.data;
      const normalized = (items || []).map((item) => ({
        id: item.other_user_id || item.user_id,
        name: item.other_user_name || item.name,
        profile_picture: item.other_user_picture || item.profile_picture,
        last_message:
          item.last_message ||
          item.content ||
          (item.media_url
            ? (isVideoUrl(item.media_url) ? 'Sent a video' : 'Sent a photo')
            : ''),
        last_message_time: item.last_message_time || item.created_at,
        unread_count: item.unread_count || 0,
      }));
      setConversations(normalized.filter((item) => item.id));
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadFollowers = async () => {
    if (!user?.id) return;
    try {
      const response = await userAPI.getFollowers(user.id);
      const items = response.data.results || response.data || [];
      const normalized = items.map((item) => ({
        id: item.user_id || item.id,
        name: item.name,
        profile_picture: item.profile_picture,
      }));
      setFollowers(normalized.filter((item) => item.id));
    } catch (error) {
      console.error('Error loading followers:', error);
    }
  };

  const loadMessages = async (userId) => {
    setLoading(true);
    try {
      const response = await chatAPI.getMessages(userId);
      const rawMessages = response.data.results || response.data || [];
      const sanitizedMessages = rawMessages.filter(
        (message) => (message.content && String(message.content).trim()) || message.media_url,
      );
      setMessages(sanitizedMessages);
      setSelectedUser(userId);
      selectedUserRef.current = userId;
      setIsSidebarOpen(false);
    } catch (error) {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;

    const existingSocket = wsRef.current;
    if (existingSocket && existingSocket.readyState < WebSocket.CLOSING) {
      existingSocket.close();
    }

    const wsBase = API_ORIGIN.startsWith('https:')
      ? API_ORIGIN.replace('https:', 'wss:')
      : API_ORIGIN.replace('http:', 'ws:');
    const wsUrl = `${wsBase}/ws/chat/?token=${token}`;
    const websocket = new WebSocket(wsUrl);
    wsRef.current = websocket;

    websocket.onopen = () => {
      console.log('WebSocket connected');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const activeUserId = Number(selectedUserRef.current);
      if (data.type === 'chat_message') {
        const message = data.message;
        const isRenderable =
          message && ((message.content && String(message.content).trim()) || message.media_url);
        if (isRenderable && (Number(message.sender_id) === activeUserId || Number(message.receiver_id) === activeUserId)) {
          appendMessageIfNew(message);
        }
        if (Number(message.sender_id) === activeUserId) {
          setIsPeerTyping(false);
        }
        loadConversations();
        return;
      }

      if (data.type === 'message_sent') {
        const message = data.message;
        const isRenderable =
          message && ((message.content && String(message.content).trim()) || message.media_url);
        if (isRenderable && Number(message.receiver_id) === activeUserId) {
          appendMessageIfNew(message);
        }
        loadConversations();
        return;
      }

      if (data.type === 'typing') {
        if (Number(data.sender_id) !== activeUserId) {
          return;
        }

        if (data.is_typing) {
          setIsPeerTyping(true);
          if (peerTypingTimeoutRef.current) {
            clearTimeout(peerTypingTimeoutRef.current);
          }
          peerTypingTimeoutRef.current = setTimeout(() => {
            setIsPeerTyping(false);
          }, 2000);
        } else {
          setIsPeerTyping(false);
        }
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      if (!shouldReconnectRef.current || wsRef.current !== websocket) {
        return;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        if (shouldReconnectRef.current && localStorage.getItem('accessToken')) {
          connectWebSocket();
        }
      }, 2000);
    };

    return websocket;
  };

  const sendTypingState = (isTyping) => {
    const activeSocket = wsRef.current;
    if (!selectedUser || !activeSocket || activeSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    activeSocket.send(JSON.stringify({
      type: 'typing',
      receiver_id: selectedUser,
      is_typing: isTyping,
    }));
  };

  const stopTyping = () => {
    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
    }
    if (typingHeartbeatRef.current) {
      clearInterval(typingHeartbeatRef.current);
      typingHeartbeatRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTypingState(false);
    }
  };

  const startTypingHeartbeat = () => {
    if (typingHeartbeatRef.current) {
      return;
    }

    typingHeartbeatRef.current = setInterval(() => {
      if (!isTypingRef.current || !newMessage.trim()) {
        if (typingHeartbeatRef.current) {
          clearInterval(typingHeartbeatRef.current);
          typingHeartbeatRef.current = null;
        }
        return;
      }
      sendTypingState(true);
    }, 1000);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);
    setIsSidebarOpen(false);

    if (!selectedUser) {
      return;
    }

    if (value.trim() && !isTypingRef.current) {
      isTypingRef.current = true;
      sendTypingState(true);
      startTypingHeartbeat();
    } else if (value.trim() && isTypingRef.current) {
      startTypingHeartbeat();
    } else if (!value.trim()) {
      stopTyping();
      return;
    }

    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
    }

    typingStopTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 900);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    stopTyping();
    setIsSidebarOpen(false);

    try {
      const activeSocket = wsRef.current;
      if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
        activeSocket.send(JSON.stringify({
          type: 'chat_message',
          content: newMessage,
          receiver_id: selectedUser,
        }));
        setNewMessage('');
      } else {
        // Fallback to REST API
        await chatAPI.sendMessage({
          receiver_id: selectedUser,
          content: newMessage,
        });
        setNewMessage('');
        loadMessages(selectedUser);
      }
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const API_ORIGIN = (() => {
    try {
      return new URL(api.defaults.baseURL).origin;
    } catch (error) {
      return window.location.origin;
    }
  })();

  useEffect(() => {
    setIsPeerTyping(false);
    stopTyping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  const resolveMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/')) {
      return `${API_ORIGIN}${url}`;
    }
    return `${API_ORIGIN}/${url}`;
  };

  const isVideoUrl = (url) => {
    if (!url) return false;
    const clean = url.split('?')[0].toLowerCase();
    return clean.endsWith('.mp4') || clean.endsWith('.mov') || clean.endsWith('.avi') || clean.endsWith('.wmv');
  };

  const handleMediaUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setIsSidebarOpen(false);
    if (!selectedUser) {
      toast.error('Select a conversation first');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      toast.error('Unsupported file type');
      return;
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const allowedImageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const allowedVideoExts = ['mp4', 'avi', 'mov', 'wmv'];
    if (isImage && fileExt && !allowedImageExts.includes(fileExt)) {
      toast.error(`Invalid image format. Allowed: ${allowedImageExts.join(', ')}`);
      return;
    }
    if (isVideo && fileExt && !allowedVideoExts.includes(fileExt)) {
      toast.error(`Invalid video format. Allowed: ${allowedVideoExts.join(', ')}`);
      return;
    }

    const formData = new FormData();
    formData.append(isImage ? 'image' : 'video', file);
    formData.append('receiver_id', selectedUser);

    try {
      const response = isImage
        ? await chatAPI.uploadImage(formData)
        : await chatAPI.uploadVideo(formData);
      const mediaUrl = response.data?.image_url || response.data?.video_url;

      if (!mediaUrl) {
        toast.error('Media upload failed');
        return;
      }

      const activeSocket = wsRef.current;
      if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
        activeSocket.send(JSON.stringify({
          type: 'chat_message',
          receiver_id: selectedUser,
          content: '',
          media_url: mediaUrl,
        }));
      } else {
        await chatAPI.sendMessage({
          receiver_id: selectedUser,
          content: '',
          media_url: mediaUrl,
        });
        loadMessages(selectedUser);
      }
      toast.success(isImage ? 'Image sent!' : 'Video sent!');
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to send media';
      toast.error(message);
    }
  };

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="chat-container">
          {isSidebarOpen && (
            <div
              className="chat-sidebar-backdrop"
              onClick={() => setIsSidebarOpen(false)}
              aria-hidden="true"
            />
          )}          <div className={`conversations-sidebar ${isSidebarOpen ? 'open' : ''}`}>
            <h3>Messages</h3>
            <div className="chat-list-toggle">
              <button
                className={activeList === 'conversations' ? 'active' : ''}
                onClick={() => setActiveList('conversations')}
                type="button"
              >
                Conversations
              </button>
              <button
                className={activeList === 'followers' ? 'active' : ''}
                onClick={() => setActiveList('followers')}
                type="button"
              >
                Followers
              </button>
            </div>
            <div className="conversations-list">
              {activeList === 'conversations' ? (
                conversations.length === 0 ? (
                  <p>No conversations yet</p>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`conversation-item ${selectedUser === conv.id ? 'active' : ''}`}
                      onClick={() => loadMessages(conv.id)}
                    >
                      <img
                        src={resolveMediaUrl(conv.profile_picture) || '/default-avatar.png'}
                        alt={conv.name}
                        className="avatar-small"
                      />
                      <div className="conversation-info">
                        <h4>{conv.name}</h4>
                        <p className="last-message">{conv.last_message}</p>
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="unread-badge">{conv.unread_count}</span>
                      )}
                    </div>
                  ))
                )
              ) : followers.length === 0 ? (
                <p>No followers yet</p>
              ) : (
                followers.map((follower) => (
                  <div
                    key={follower.id}
                    className={`conversation-item ${selectedUser === follower.id ? 'active' : ''}`}
                    onClick={() => loadMessages(follower.id)}
                  >
                    <img
                      src={resolveMediaUrl(follower.profile_picture) || '/default-avatar.png'}
                      alt={follower.name}
                      className="avatar-small"
                    />
                    <div className="conversation-info">
                      <h4>{follower.name}</h4>
                      <p className="last-message">Start a chat</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="chat-main">
            <div className="chat-header-actions">
              <button
                className="sidebar-toggle-btn"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                type="button"
                aria-label="Toggle conversations"
              >
                {isSidebarOpen ? <FaTimes /> : <FaBars />}
              </button>
            </div>
            {!selectedUser ? (
              <div className="no-chat-selected">
                <p>Select a conversation to start messaging</p>
              </div>
            ) : (
              <>
                <div className="messages-container">
                  {loading ? (
                    <div className="loading">Loading messages...</div>
                  ) : (
                    <>
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`message ${message.sender_id === user.id ? 'sent' : 'received'}`}
                        >
                          <div className="message-content">
                            {message.media_url && (
                              isVideoUrl(message.media_url) ? (
                                <video
                                  src={resolveMediaUrl(message.media_url)}
                                  className="message-video"
                                  controls
                                />
                              ) : (
                                <img
                                  src={resolveMediaUrl(message.media_url)}
                                  alt="attachment"
                                  className="message-image"
                                />
                              )
                            )}
                            {message.content ? (
                              <p>{message.content}</p>
                            ) : message.media_url ? (
                              <p className="media-caption-placeholder">
                                {isVideoUrl(message.media_url) ? 'Video' : 'Photo'}
                              </p>
                            ) : null}
                            <span className="message-time">
                              {moment(message.created_at).format('HH:mm')}
                            </span>
                          </div>
                        </div>
                      ))}
                      {isPeerTyping && (
                        <div className="message received typing-row">
                          <div className="typing-bubble" aria-label="Typing">
                            <span />
                            <span />
                            <span />
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="message-input-form">
                  <label className="upload-btn">
                    <FaImage />
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleMediaUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={handleInputChange}
                  />
                  <button type="submit" disabled={!newMessage.trim()}>
                    <FaPaperPlane />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
