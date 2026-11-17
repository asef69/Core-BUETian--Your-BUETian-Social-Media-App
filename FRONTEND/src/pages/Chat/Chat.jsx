import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaRegCommentDots } from 'react-icons/fa';
import { chatAPI, userAPI } from '../../services/apiService';
import { REALTIME_ENABLED } from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useChatSocket } from '../../hooks/useChatSocket';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import Navbar from '../../components/Navbar';
import ConversationList from '../../components/chat/ConversationList';
import ChatHeader from '../../components/chat/ChatHeader';
import MessageList from '../../components/chat/MessageList';
import MessageComposer from '../../components/chat/MessageComposer';
import { isVideoUrl } from '../../components/chat/MessageBubble';
import '../../styles/Chat.css';

const TYPING_HEARTBEAT_MS = 1000;
const TYPING_IDLE_MS = 2500;
const PEER_TYPING_EXPIRY_MS = 2000;
const POLL_INTERVAL_MS = 5000;

const hasContent = (message) =>
  Boolean(message && ((message.content && String(message.content).trim()) || message.media_url));

const Chat = () => {
  const { userId: chatUserId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOnline = useOnlineStatus();

  const [conversations, setConversations] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [peerProfile, setPeerProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [activeTab, setActiveTab] = useState('conversations');
  const [search, setSearch] = useState('');

  const selectedUserRef = useRef(null);
  const draftRef = useRef('');
  const prefillAppliedRef = useRef(false);
  const typingStopTimeoutRef = useRef(null);
  const typingHeartbeatRef = useRef(null);
  const peerTypingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const messagesCacheRef = useRef({});
  const loadRequestIdRef = useRef(0);
  const sendRef = useRef(() => false);

  const currentUserId = user?.id;

  /* ---------------------------------------------------------------- lists */

  const loadConversations = useCallback(async () => {
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
          (item.media_url ? (isVideoUrl(item.media_url) ? 'Sent a video' : 'Sent a photo') : ''),
        last_message_time: item.last_message_time || item.created_at,
        unread_count: item.unread_count || 0,
      }));
      setConversations(normalized.filter((item) => item.id));
      setListError(false);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setListError(true);
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadFollowers = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const response = await userAPI.getFollowers(currentUserId);
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
  }, [currentUserId]);

  useEffect(() => {
    loadConversations();
    loadFollowers();
  }, [loadConversations, loadFollowers]);

  /* ------------------------------------------------------------- messages */

  const appendMessageIfNew = (message) => {
    if (!message) return;
    setMessages((prev) => {
      if (message.id && prev.some((item) => item.id === message.id)) return prev;
      const next = [...prev, message];
      const peerId = Number(selectedUserRef.current);
      if (peerId) messagesCacheRef.current[peerId] = next;
      return next;
    });
  };

  const loadMessages = useCallback(async (userId, { silent = false } = {}) => {
    const normalizedUserId = Number(userId);
    const requestId = ++loadRequestIdRef.current;

    if (!silent) {
      setSelectedUser(normalizedUserId);
      selectedUserRef.current = normalizedUserId;
      const cached = messagesCacheRef.current[normalizedUserId];
      setMessages(Array.isArray(cached) ? cached : []);
      setLoading(true);
    }

    try {
      const response = await chatAPI.getMessages(normalizedUserId);
      if (requestId !== loadRequestIdRef.current) return;

      const sanitized = (response.data.results || response.data || []).filter(hasContent);
      messagesCacheRef.current[normalizedUserId] = sanitized;
      setMessages((prev) =>
        silent &&
        prev.length === sanitized.length &&
        prev[prev.length - 1]?.id === sanitized[sanitized.length - 1]?.id &&
        prev.every((item, index) => item.is_read === sanitized[index]?.is_read)
          ? prev
          : sanitized,
      );

      // Fetching a thread marks incoming messages as read on the server.
      setConversations((prev) =>
        prev.map((item) => (item.id === normalizedUserId ? { ...item, unread_count: 0 } : item)),
      );
      window.dispatchEvent(new Event('counts:refresh'));
    } catch (error) {
      if (requestId !== loadRequestIdRef.current || silent) return;

      const statusCode = error?.response?.status;
      const errorMessage = error?.response?.data?.error;
      toast.error(
        statusCode === 403
          ? errorMessage || 'Messaging is not allowed with this user'
          : errorMessage || 'Failed to load previous messages',
      );
    } finally {
      if (!silent && requestId === loadRequestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (chatUserId) loadMessages(chatUserId);
  }, [chatUserId, loadMessages]);

  useEffect(() => {
    prefillAppliedRef.current = false;
  }, [chatUserId]);

  useEffect(() => {
    const starterMessage = searchParams.get('message');
    if (!chatUserId || !starterMessage || prefillAppliedRef.current) return;
    setNewMessage(starterMessage);
    draftRef.current = starterMessage;
    prefillAppliedRef.current = true;
  }, [chatUserId, searchParams]);

  // Who is on the other end? Prefer data we already have, otherwise ask the API.
  const knownPeer =
    conversations.find((item) => item.id === selectedUser) ||
    followers.find((item) => item.id === selectedUser) ||
    null;

  useEffect(() => {
    if (!selectedUser || knownPeer) return undefined;
    let cancelled = false;
    userAPI
      .getProfile(selectedUser)
      .then((response) => {
        if (cancelled) return;
        setPeerProfile({
          id: selectedUser,
          name: response.data?.name,
          profile_picture: response.data?.profile_picture,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedUser, knownPeer]);

  const peer =
    knownPeer || (peerProfile?.id === selectedUser ? peerProfile : { id: selectedUser });

  /* --------------------------------------------------------------- typing */

  const clearPeerTyping = () => {
    if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current);
    setIsPeerTyping(false);
  };

  const sendTypingState = (isTyping) => {
    const receiver = selectedUserRef.current;
    if (!receiver) return;
    sendRef.current({ type: 'typing', receiver_id: receiver, is_typing: isTyping });
  };

  const stopTyping = () => {
    if (typingStopTimeoutRef.current) clearTimeout(typingStopTimeoutRef.current);
    if (typingHeartbeatRef.current) {
      clearInterval(typingHeartbeatRef.current);
      typingHeartbeatRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTypingState(false);
    }
  };

  const handleInputChange = (event) => {
    const value = event.target.value;
    setNewMessage(value);
    draftRef.current = value;

    if (!selectedUserRef.current) return;
    if (!value.trim()) {
      stopTyping();
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTypingState(true);
    }
    // The receiver treats typing as expired after ~2s, so keep refreshing it.
    if (!typingHeartbeatRef.current) {
      typingHeartbeatRef.current = setInterval(() => {
        if (!isTypingRef.current || !draftRef.current.trim()) {
          stopTyping();
          return;
        }
        sendTypingState(true);
      }, TYPING_HEARTBEAT_MS);
    }
    if (typingStopTimeoutRef.current) clearTimeout(typingStopTimeoutRef.current);
    typingStopTimeoutRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  useEffect(() => {
    clearPeerTyping();
    stopTyping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  /* ------------------------------------------------------------ websocket */

  const handleSocketEvent = (data) => {
    const activeUserId = Number(selectedUserRef.current);

    switch (data.type) {
      case 'socket_open':
        if (data.reconnected) {
          // Catch up on anything that arrived while the connection was down.
          loadConversations();
          if (activeUserId) loadMessages(activeUserId, { silent: true });
        }
        break;

      case 'chat_message': {
        const { message } = data;
        if (!message) break;
        const fromActivePeer = Number(message.sender_id) === activeUserId;
        if (hasContent(message) && (fromActivePeer || Number(message.receiver_id) === activeUserId)) {
          appendMessageIfNew(message);
        }
        if (fromActivePeer) {
          setIsPeerTyping(false);
          // The thread is open, so tell the sender it was read.
          if (message.id) {
            sendRef.current({ type: 'read_message', message_id: message.id, sender_id: message.sender_id });
          }
        }
        loadConversations();
        break;
      }

      case 'message_sent': {
        const { message } = data;
        if (hasContent(message) && Number(message.receiver_id) === activeUserId) {
          appendMessageIfNew(message);
        }
        loadConversations();
        break;
      }

      case 'message_read':
        setMessages((prev) =>
          prev.map((item) => (item.id === data.message_id ? { ...item, is_read: true } : item)),
        );
        break;

      case 'typing':
        if (Number(data.sender_id) !== activeUserId) break;
        if (data.is_typing) {
          setIsPeerTyping(true);
          if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current);
          peerTypingTimeoutRef.current = setTimeout(() => setIsPeerTyping(false), PEER_TYPING_EXPIRY_MS);
        } else {
          setIsPeerTyping(false);
        }
        break;

      default:
        break;
    }
  };

  const { status: socketStatus, send } = useChatSocket({
    userId: currentUserId,
    onEvent: handleSocketEvent,
  });
  sendRef.current = send;

  useEffect(
    () => () => {
      if (typingStopTimeoutRef.current) clearTimeout(typingStopTimeoutRef.current);
      if (typingHeartbeatRef.current) clearInterval(typingHeartbeatRef.current);
      if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current);
    },
    [],
  );

  // Hosts without WebSocket support (e.g. Vercel): poll the REST API instead.
  useEffect(() => {
    if (REALTIME_ENABLED) return undefined;
    const intervalId = setInterval(() => {
      loadConversations();
      const activeUserId = Number(selectedUserRef.current);
      if (activeUserId) loadMessages(activeUserId, { silent: true });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [loadConversations, loadMessages]);

  /* -------------------------------------------------------------- sending */

  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !selectedUser) return;

    stopTyping();

    const sentLive = send({ type: 'chat_message', content: newMessage, receiver_id: selectedUser });
    if (sentLive) {
      setNewMessage('');
      draftRef.current = '';
      return;
    }

    // Socket unavailable: fall back to the REST API so the message still goes out.
    try {
      await chatAPI.sendMessage({ receiver_id: selectedUser, content: newMessage });
      setNewMessage('');
      draftRef.current = '';
      loadMessages(selectedUser, { silent: true });
      loadConversations();
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const handleMediaUpload = async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
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

    setUploading(true);
    try {
      const response = isImage
        ? await chatAPI.uploadImage(formData)
        : await chatAPI.uploadVideo(formData);
      const mediaUrl = response.data?.image_url || response.data?.video_url;

      if (!mediaUrl) {
        toast.error('Media upload failed');
        return;
      }

      const sentLive = send({
        type: 'chat_message',
        receiver_id: selectedUser,
        content: '',
        media_url: mediaUrl,
      });
      if (!sentLive) {
        await chatAPI.sendMessage({ receiver_id: selectedUser, content: '', media_url: mediaUrl });
        loadMessages(selectedUser, { silent: true });
      }
      toast.success(isImage ? 'Image sent!' : 'Video sent!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send media');
    } finally {
      setUploading(false);
    }
  };

  /* ----------------------------------------------------------- navigation */

  const handleBack = () => {
    loadRequestIdRef.current += 1;
    selectedUserRef.current = null;
    setSelectedUser(null);
    setMessages([]);
    setNewMessage('');
    draftRef.current = '';
    if (chatUserId) navigate('/chat');
  };

  // On phones an open conversation takes over the whole screen.
  useEffect(() => {
    document.body.classList.toggle('chat-thread-open', Boolean(selectedUser));
    return () => document.body.classList.remove('chat-thread-open');
  }, [selectedUser]);

  const showReconnectBanner =
    isOnline && REALTIME_ENABLED && (socketStatus === 'reconnecting' || socketStatus === 'disconnected');

  return (
    <div className="app-layout chat-page">
      <Navbar />
      <div className="main-content">
        <div className={`chat-shell ${selectedUser ? 'chat-shell--thread' : ''}`}>
          <ConversationList
            conversations={conversations}
            followers={followers}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            search={search}
            onSearchChange={setSearch}
            selectedId={selectedUser}
            onSelect={loadMessages}
            loading={listLoading}
            error={listError}
            onRetry={() => {
              setListLoading(true);
              loadConversations();
            }}
          />

          <section className="chat-thread" aria-label="Conversation">
            {!selectedUser ? (
              <div className="chat-placeholder">
                <FaRegCommentDots aria-hidden="true" />
                <h2>Your messages</h2>
                <p>Pick a conversation, or choose a follower to start a new one.</p>
              </div>
            ) : (
              <>
                <ChatHeader
                  peer={peer}
                  isTyping={isPeerTyping}
                  connectionStatus={socketStatus}
                  onBack={handleBack}
                />
                {showReconnectBanner && (
                  <div className="chat-banner" role="status">
                    Live connection lost. Reconnecting… your messages will still be delivered.
                  </div>
                )}
                <MessageList
                  messages={messages}
                  currentUserId={currentUserId}
                  loading={loading}
                  isPeerTyping={isPeerTyping}
                  peerName={peer?.name}
                  threadKey={selectedUser}
                />
                <MessageComposer
                  value={newMessage}
                  onChange={handleInputChange}
                  onSubmit={handleSendMessage}
                  onAttach={handleMediaUpload}
                  uploading={uploading}
                />
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Chat;
