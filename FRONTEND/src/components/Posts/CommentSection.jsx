import React, { useState, useEffect, useRef } from 'react';
import { postAPI } from '../../services/apiService';
import { toast } from 'react-toastify';
import moment from 'moment';
import { FaEllipsisH } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';

const CommentSection = ({ postId, onCommentAdded, onCommentRemoved }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);

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
      const normalized = extractComments(response.data).map(normalizeComment);
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
                      aria-label="Comment actions"
                      onClick={() => setOpenMenuId(openMenuId === comment.comment_id ? null : comment.comment_id)}
                    >
                      <FaEllipsisH />
                    </button>

                    {openMenuId === comment.comment_id && (
                      <div className="comment-menu-dropdown" role="menu">
                        <button
                          type="button"
                          className="comment-menu-item"
                          onClick={() => {
                            setOpenMenuId(null);
                            handleEditComment(comment);
                          }}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="comment-menu-item delete"
                          onClick={() => {
                            handleDeleteComment(comment.comment_id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* EDIT OR VIEW COMMENT */}
              {editingCommentId === comment.comment_id ? (
                <div className="edit-comment-form">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows="2"
                  />
                  <div className="edit-actions">
                    <button
                      type="button"
                      className="save-btn"
                      onClick={() => handleUpdateComment(comment)}
                    >
                      Save
                    </button>

                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p>{comment.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommentSection;