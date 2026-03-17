import React, { useState, useEffect, useRef } from 'react';
import { postAPI } from '../../services/apiService';
import { toast } from 'react-toastify';
import moment from 'moment';
import { FaEllipsisH } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { FaHeart, FaRegHeart } from 'react-icons/fa';


const CommentSection = ({ postId, onCommentAdded, onCommentRemoved }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [replyingComments, setReplyingComments] = useState({});
  const [replyContent, setReplyContent] = useState({});

  const toggleReply = (commentId) => {
    setReplyingComments((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  useEffect(() => {
    loadComments();
  }, [postId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close any open menu if click is outside a menu
      if (!event.target.closest('.comment-menu')) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const normalizeComment = (comment) => {
    const userFromObject = comment.user || comment.author || {};

    return {
      ...comment,
      comment_id: comment.comment_id || comment.id,
      user_id: comment.user_id || comment.author_id || userFromObject.id,
      user_name: comment.user_name || comment.author_name || userFromObject.name,
      user_profile_picture:
        comment.user_profile_picture ||
        comment.user_picture ||
        comment.author_picture ||
        userFromObject.profile_picture,
        
      likes_count: comment.likes_count || 0,
      liked: comment.liked ?? comment.is_liked ?? false,
    };
  };

  const extractComments = (data) => {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.results)) {
      return data.results;
    }

    if (Array.isArray(data?.comments)) {
      return data.comments;
    }

    return [];
  };

  const loadComments = async () => {
  try {
    const response = await postAPI.getComments(postId);

    const normalized = extractComments(response.data).map(comment => ({
      ...normalizeComment(comment),
    }));

    setComments(normalized);
  } catch (error) {
    console.error('Error loading comments:', error);
  }
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      console.log('🔄 Attempting to add comment:', { postId, postIdType: typeof postId, content: newComment });

      if (!postId) {
        console.error('❌ Post ID is missing for comment');
        toast.error('Cannot add comment: Post ID is missing');
        setLoading(false);
        return;
      }

      const response = await postAPI.addComment(postId, { content: newComment });
      console.log('✅ Comment added successfully:', response.data);
      const normalizedComment = normalizeComment(response.data);
      setComments([normalizedComment, ...comments]);
      setNewComment('');
      if (onCommentAdded) {
        onCommentAdded();
      }
      toast.success('Comment added!');

    } catch (error) {
      console.error('❌ Failed to add comment:', {
        postId,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.response?.data?.message || error.message,
        url: error.config?.url,
        data: error.response?.data
      });

      if (error.response?.status === 404) {
        toast.error('Post not found. The post may have been deleted.');
      } else if (error.response?.status === 401) {
        toast.error('Please login to add comments');
      } else if (error.response?.status === 400) {
        toast.error(error.response?.data?.content?.[0] || 'Invalid comment content');
      } else {
        toast.error(error.response?.data?.message || 'Failed to add comment');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (comment_id) => {
    if (!comment_id) {
      toast.error('Cannot delete: Comment ID is missing');
      return;
    }

    if (!window.confirm('Delete this comment?')) return;

    try {
      console.log("Deleting comment ID:", comment_id);

      // Call API
      await postAPI.deleteComment(comment_id);

      // Remove from state
      setComments(comments.filter(c => c.comment_id !== comment_id));
      if (onCommentRemoved) {
        onCommentRemoved();
      }

      toast.success('Comment deleted');
    } catch (error) {
      console.error('❌ Failed to delete comment:', error);
      toast.error(error?.response?.data?.error || 'Failed to delete comment');
    }
  };

  const handleEditComment = (comment) => {
    setEditingCommentId(comment.comment_id);
    setEditContent(comment.content);
  };

  const handleUpdateComment = async (comment) => {
    try {
      if (!comment.comment_id) {
        toast.error('Cannot update: Comment ID is missing');
        return;
      }
      await postAPI.updateComment(comment.comment_id, { content: editContent });
      setComments(comments.map(c =>
        c.comment_id === comment.comment_id ? { ...c, content: editContent } : c
      ));
      setEditingCommentId(null);
      setEditContent('');
      toast.success('Comment updated');
    } catch (error) {
      console.error('❌ Failed to update comment:', {
        commentId: comment.comment_id,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.response?.data?.message || error.message,
        url: error.config?.url,
        data: error.response?.data
      });
      toast.error(error?.response?.data?.error || 'Failed to update comment');
    }
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent('');
  };

  const handleReplySubmit = async (e, parentCommentId) => {
    e.preventDefault();
    const content = replyContent[parentCommentId];
    if (!content?.trim()) return;

    setLoading(true);
    try {
      const response = await postAPI.addComment(postId, {
        content,
        parent_comment_id: parentCommentId,
      });

      const normalizedReply = normalizeComment(response.data);

      // Insert reply just below the parent comment
      setComments(prevComments => {
        const index = prevComments.findIndex(c => c.comment_id === parentCommentId);
        const updated = [...prevComments];
        updated.splice(index + 1, 0, normalizedReply);
        return updated;
      });

      // clear only this comment's reply input
      setReplyContent(prev => ({ ...prev, [parentCommentId]: '' }));

      // close reply form if desired
      setReplyingComments(prev => ({ ...prev, [parentCommentId]: false }));

      toast.success('Reply added!');
    } catch (error) {
      console.error('❌ Failed to reply:', error);
      toast.error(error?.response?.data?.error || 'Failed to add reply');
    } finally {
      setLoading(false);
    }
  };

  const handleCommentLike = async (commentId) => {
    try {
      console.log('🔄 Attempting to like comment:', {
        commentId: commentId,
        commentIdType: typeof commentId
      });

      if (!commentId) {
        console.error('❌ Comment ID is missing');
        toast.error('Cannot like comment: Comment ID is missing');
        return;
      }

      await postAPI.likecomment(commentId);

      console.log('✅ Comment liked successfully:', commentId);

      setComments(prevComments =>
        prevComments.map(comment =>
          comment.comment_id === commentId
            ? {
              ...comment,
              liked: !comment.liked,
              likes_count: comment.liked
                ? comment.likes_count - 1
                : comment.likes_count + 1
            }
            : comment
        )
      );

    } catch (error) {
      console.error("❌ Failed to like comment:", {
        commentId,
        status: error.response?.status || "No response",
        statusText: error.response?.statusText || "",
        message: error.response?.data?.message || error.response?.data?.error || error.message,
        url: error.config?.url,
        method: error.config?.method,
        fullError: error, // Logs entire Axios error for deep debugging
      });

      if (error.response?.status === 404) {
        toast.error('Comment not found. It may have been deleted.');
      } else if (error.response?.status === 401) {
        toast.error('Please login to like comments');
      } else {
        toast.error(
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          'Failed to like comment'
        );
      }
    }
  };

  console.log("COMMENTS:", comments);
  return (
    <div className="comments-section">
      <form onSubmit={handleSubmit} className="comment-form">
        <input
          type="text"
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <button type="submit" disabled={loading || !newComment.trim()}>
          {loading ? 'Posting...' : 'Post'}
        </button>
      </form>

      <div className="comments-list">
        {comments.map((comment) => (
          <div key={comment.comment_id} className="comment">
            <img
              src={comment.user_profile_picture || '/default-avatar.png'}
              alt={comment.user_name || 'User'}
              className="comment-avatar"
              onError={(e) => { e.target.src = '/default-avatar.png'; }}
            />
            <div className="comment-content">
              <div className="comment-header">
                <strong>{comment.user_name || 'Unknown User'}</strong>
                <span className="comment-time">
                  {moment.utc(comment.created_at).local().fromNow()}
                </span>
                {user && Number(user.id) === Number(comment.user_id) && (
                  <div className="comment-menu">
                    <button
                      className="comment-menu-trigger"
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === comment.comment_id ? null : comment.comment_id)}
                    >
                      <FaEllipsisH />
                    </button>
                    {openMenuId === comment.comment_id && (
                      <div className="comment-menu-dropdown" role="menu">
                        <button type="button" className="comment-menu-item" onClick={() => handleEditComment(comment)}>Edit</button>
                        <button type="button" className="comment-menu-item delete" onClick={() => handleDeleteComment(comment.comment_id)}>Delete</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Comment content or edit box */}
              {editingCommentId === comment.comment_id ? (
                <div className="edit-comment-form">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows="2"
                  />
                  <div className="edit-actions">
                    <button type="button" className="save-btn" onClick={() => handleUpdateComment(comment)}>Save</button>
                    <button type="button" className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <p>{comment.content}</p>
              )}

              {/* Reply toggle button */}
              <button
                className="btn-reply"
                type="button"
                onClick={() => toggleReply(comment.comment_id)}
              >
                Reply
              </button>

              {/* Reply box for this comment */}
              {replyingComments[comment.comment_id] && (
                <form
                  className="edit-comment-form reply-box"
                  onSubmit={(e) => handleReplySubmit(e, comment.comment_id)}
                >
                  <textarea
                    value={replyContent[comment.comment_id] || ""}
                    onChange={(e) =>
                      setReplyContent(prev => ({
                        ...prev,
                        [comment.comment_id]: e.target.value,
                      }))
                    }
                    rows="2"
                    placeholder="Write a reply..."
                  />
                  <div className="edit-actions">
                    <button type="submit" className="save-btn" disabled={loading}>
                      Post
                    </button>
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={() => toggleReply(comment.comment_id)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              <button
                className={`action-btn ${comment.liked ? 'liked' : ''}`}
                onClick={() => handleCommentLike(comment.comment_id)}
              >
                {comment.liked ? <FaHeart color="#e74c3c" /> : <FaRegHeart />}
                {comment.likes_count > 0 ? (
                  <span className="count-pill">{comment.likes_count}</span>
                ) : null}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommentSection;