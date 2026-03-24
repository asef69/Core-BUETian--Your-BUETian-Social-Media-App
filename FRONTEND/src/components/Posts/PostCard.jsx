import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { postAPI } from '../../services/apiService';
import { toast } from 'react-toastify';
import { FaHeart, FaRegHeart, FaComment, FaEllipsisH } from 'react-icons/fa';
import moment from 'moment';
import CommentSection from './CommentSection';
import { useAuth } from '../../context/AuthContext';

const PostCard = ({ post, onLike, readOnly = false }) => {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(
    Boolean(post.has_liked ?? post.is_liked ?? post.liked ?? false),
  );
  const [likesCount, setLikesCount] = useState(Number(post.likes_count) || 0);
  const [commentsCount, setCommentsCount] = useState(Number(post.comments_count) || 0);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [editVisibility, setEditVisibility] = useState(post.visibility || 'public');
  const [showPostMenu, setShowPostMenu] = useState(false);
  const postMenuRef = useRef(null);
  const postId = post.id || post.post_id;

  const renderContentWithHashtags = (content) => {
    const text = content || '';
    const parts = text.split(/(#[A-Za-z0-9_]+)/g);
    return parts.map((part, index) => {
      if (/^#[A-Za-z0-9_]+$/.test(part)) {
        const hashtag = part.slice(1);
        return (
          <Link key={`${hashtag}-${index}`} to={`/search?q=${encodeURIComponent(hashtag)}`} className="hashtag-link">
            {part}
          </Link>
        );
      }
      return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
    });
  };

  // Debug: Log post data structure
  React.useEffect(() => {
    if (!post.user_id || !post.user_name) {
      console.warn('⚠️ PostCard missing user data:', {
        user_id: post.user_id,
        user_name: post.user_name,
        profile_picture: post.profile_picture,
        author_id: post.author_id,
        author_name: post.author_name,
        author_picture: post.author_picture,
        postId: post.id,
        message: 'Backend is using author_* fields instead of user_* fields'
      });
    }
  }, [post]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (postMenuRef.current && !postMenuRef.current.contains(event.target)) {
        setShowPostMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setLiked(Boolean(post.has_liked ?? post.is_liked ?? post.liked ?? false));
    setLikesCount(Number(post.likes_count) || 0);
    setCommentsCount(Number(post.comments_count) || 0);
  }, [post.has_liked, post.is_liked, post.liked, post.likes_count, post.comments_count]);

  const handleLike = async () => {
    if (readOnly) {
      return;
    }

    try {
      console.log('🔄 Attempting to like post:', { postId: post.id, postIdType: typeof post.id });

      if (!postId) {
        console.error('❌ Post ID is missing:', post);
        toast.error('Cannot like post: Post ID is missing');
        return;
      }

      const response = await postAPI.likePost(postId);
      console.log('✅ Post liked successfully:', response?.data);

      const nextLiked =
        response?.data?.liked ?? !liked;
      const nextLikesCount =
        typeof response?.data?.likes_count === 'number'
          ? response.data.likes_count
          : (nextLiked ? likesCount + 1 : Math.max(0, likesCount - 1));

      setLiked(Boolean(nextLiked));
      setLikesCount(Number(nextLikesCount) || 0);
      if (onLike) {
        onLike(postId);
      }
    } catch (error) {
      console.error('❌ Failed to like post:', {
        postId: postId,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.response?.data?.message || error.message,
        url: error.config?.url,
        data: error.response?.data
      });

      if (error.response?.status === 404) {
        toast.error('Post not found. The post may have been deleted.');
      } else if (error.response?.status === 401) {
        toast.error('Please login to like posts');
      } else {
        toast.error(error.response?.data?.message || 'Failed to like post');
      }
    }
  };

  const MEDIA_BASE_URL = 'http://localhost:8000';

  const toAbsoluteUrl = (url) => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('//')) return `${window.location.protocol}${url}`;
    const normalized = url.startsWith('/') ? url : `/${url}`;
    return `${MEDIA_BASE_URL}${normalized}`;
  };

  const inferMediaType = (url, fallbackType) => {
    if (fallbackType) return fallbackType;
    if (!url) return 'image';
    if (/\.(mp4|webm|ogg|mov|m4v)$/i.test(url)) return 'video';
    return 'image';
  };

  const normalizeMediaItems = (postData) => {
    const candidates =
      postData.media_urls ||
      postData.media_urls_list ||
      postData.media_files ||
      postData.media ||
      postData.images ||
      postData.videos ||
      [];

    const list = Array.isArray(candidates) ? candidates : [candidates];
    const mapped = list
      .map((item) => {
        if (!item) return null;

        if (typeof item === 'string') {
          return {
            url: toAbsoluteUrl(item),
            type: inferMediaType(item, postData.media_type),
          };
        }

        if (item.media_url) {
          return {
            url: toAbsoluteUrl(item.media_url),
            type: inferMediaType(item.media_url, item.media_type),
          };
        }

        const rawUrl = item.url || item.file || item.image || item.video;
        if (!rawUrl) return null;

        return {
          url: toAbsoluteUrl(rawUrl),
          type: inferMediaType(rawUrl, item.type),
        };
      })
      .filter(Boolean);

    if (mapped.length > 0) return mapped;

    const singleUrl = postData.media_url || postData.image || postData.video;
    if (!singleUrl) return [];
    return [
      {
        url: toAbsoluteUrl(singleUrl),
        type: inferMediaType(singleUrl, postData.media_type),
      },
    ];
  };

  const handleCommentAdded = () => {
    setCommentsCount(commentsCount + 1);
  };
  const handleCommentRemoved = () => {
    setCommentsCount(commentsCount - 1);
  };

  const isOwner = user && Number(user.id) === Number(post.user_id);

  const handleDelete = async () => {
    if (!window.confirm('Delete this post?')) return;
    try {
      if (!postId) {
        toast.error('Cannot delete: Post ID is missing');
        return;
      }
      await postAPI.deletePost(postId);
      toast.success('Post deleted');
      window.location.reload();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to delete post');
    }
  };

  const handleUpdate = async () => {
    try {
      if (!postId) {
        toast.error('Cannot update: Post ID is missing');
        return;
      }
      await postAPI.updatePost(postId, { content: editContent, visibility: editVisibility });
      toast.success('Post updated');
      setEditing(false);
      window.location.reload();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to update post');
    }
  };

  const mediaItems = normalizeMediaItems(post);
  const authorName = post.user_name || post.author_name || post.owner_name || post.created_by_name || 'Unknown User';
  const authorPicture = toAbsoluteUrl(post.profile_picture || post.author_picture || post.owner_picture) || '/default-avatar.png';
  const canOpenProfile = Boolean(post.user_id);

  return (
    <div className={`post-card ${readOnly ? 'read-only' : ''}`}>
      <div className="post-header">
        {canOpenProfile ? (
          <Link to={`/profile/${post.user_id}`} className="post-author">
            <img
              src={authorPicture}
              alt={authorName}
              className="avatar"
              onError={(e) => { e.target.src = '/default-avatar.png'; }}
            />
            <div className="author-info">
              <h4>{authorName}</h4>
              <p className="post-time">
                {moment.utc(post.created_at).local().fromNow()} · {(post.visibility || 'public').toLowerCase()}
              </p>
            </div>
          </Link>
        ) : (
          <div className="post-author">
            <img
              src={authorPicture}
              alt={authorName}
              className="avatar"
              onError={(e) => { e.target.src = '/default-avatar.png'; }}
            />
            <div className="author-info">
              <h4>{authorName}</h4>
              <p className="post-time">
                {moment.utc(post.created_at).local().fromNow()} · {(post.visibility || 'public').toLowerCase()}
              </p>
            </div>
          </div>
        )}

        {isOwner && !editing && (
          <div className="post-menu" ref={postMenuRef}>
            <button
              className="post-menu-trigger"
              type="button"
              aria-label="Post actions"
              onClick={() => setShowPostMenu((prev) => !prev)}
            >
              <FaEllipsisH />
            </button>

            {showPostMenu && (
              <div className="post-menu-dropdown" role="menu">
                <button
                  type="button"
                  className="post-menu-item"
                  onClick={() => {
                    setEditing(true);
                    setShowPostMenu(false);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="post-menu-item delete"
                  onClick={() => {
                    setShowPostMenu(false);
                    handleDelete();
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="post-content">
        {editing ? (
          <div className="create-post-form">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows="3"
            />
            <select
              value={editVisibility}
              onChange={(e) => setEditVisibility(e.target.value)}
              style={{ marginBottom: '10px' }}
            >
              <option value="public">Public</option>
              <option value="followers">Followers</option>
              <option value="private">Private</option>
            </select>
            <div className="post-actions">
              <button className="action-btn" onClick={handleUpdate}>Save</button>
              <button className="action-btn" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <p>{renderContentWithHashtags(post.content)}</p>
        )}

        {mediaItems.length > 0 && (
          <div className={`post-media ${mediaItems.length > 1 ? 'media-grid' : ''}`}>
            {mediaItems.map((media, index) => (
              <div key={index} className="media-item">
                {media.type === 'video' ? (
                  <video src={media.url} controls />
                ) : (
                  <img src={media.url} alt="Post media" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="post-actions">
        <button
          className={`action-btn ${liked ? 'liked' : ''}`}
          onClick={handleLike}
          disabled={readOnly}
        >
          {liked ? <FaHeart color="#e74c3c" /> : <FaRegHeart />}
          {readOnly ? (
            <span className="count-pill">{likesCount}</span>
          ) : likesCount > 0 ? (
            <span className="count-pill">{likesCount}</span>
          ) : (
            <span>Like</span>
          )}
        </button>
        <button
          className="action-btn"
          onClick={() => setShowComments(!showComments)}
        >
          <FaComment />
          {readOnly ? (
            <span className="count-pill">{commentsCount}</span>
          ) : commentsCount > 0 ? (
            <span className="count-pill">{commentsCount}</span>
          ) : (
            <span>Comment</span>
          )}
        </button>
      </div>

      {showComments && (
        <CommentSection
          postId={postId}
          onCommentAdded={handleCommentAdded}
          onCommentRemoved={handleCommentRemoved}
          readOnly={readOnly}
        />
      )}
    </div>
  );
};

export default PostCard;
