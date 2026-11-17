import React, { useState, useEffect, useMemo } from "react";
import { postAPI } from "../../services/apiService";
import { toast } from "react-toastify";
import { FaEllipsisH } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { confirmDialog } from "../../utils/confirmDialog";
import Avatar from "../common/Avatar";
import { timeAgo, toTimestamp } from '../../utils/time';

const CommentSection = ({ postId, onCommentAdded, onCommentRemoved, readOnly = false }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editContent, setEditContent] = useState("");
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
      if (!event.target.closest(".comment-menu")) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const normalizeComment = (comment) => {
    const userFromObject = comment.user || comment.author || {};

    return {
      ...comment,
      comment_id: comment.comment_id || comment.id,
      user_id: comment.user_id || comment.author_id || userFromObject.id,
      user_name:
        comment.user_name ||
        comment.author_name ||
        comment.username ||
        userFromObject.name,
      user_profile_picture:
        comment.user_profile_picture ||
        comment.user_picture ||
        comment.author_picture ||
        userFromObject.profile_picture,
      likes_count: comment.likes_count || 0,
      liked: comment.liked ?? comment.is_liked ?? false,
      parent_comment_id: comment.parent_comment_id || null,
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
      setFetchError(false);
      const response = await postAPI.getComments(postId);

      const normalized = extractComments(response.data).map((comment) => ({
        ...normalizeComment(comment),
      }));

      setComments(normalized);
    } catch (error) {
      console.error("Error loading comments:", error);
      setFetchError(true);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e) => {
    if (readOnly) {
      return;
    }

    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    try {

      if (!postId) {
        console.error("❌ Post ID is missing for comment");
        toast.error("Cannot add comment: Post ID is missing");
        setLoading(false);
        return;
      }

      const contentToAdd = newComment.trim();
      const response = await postAPI.addComment(postId, {
        content: contentToAdd,
      });
      setNewComment("");
      await loadComments();
      if (onCommentAdded) {
        onCommentAdded();
      }
      toast.success("Comment added!");
    } catch (error) {
      console.error("❌ Failed to add comment:", {
        postId,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.response?.data?.message || error.message,
        url: error.config?.url,
        data: error.response?.data,
      });

      if (error.response?.status === 404) {
        toast.error("Post not found. The post may have been deleted.");
      } else if (error.response?.status === 401) {
        toast.error("Please login to add comments");
      } else if (error.response?.status === 400) {
        toast.error(
          error.response?.data?.content?.[0] || "Invalid comment content",
        );
      } else {
        toast.error(error.response?.data?.message || "Failed to add comment");
      }
    } finally {
      setLoading(false);
    }
  };
  const handleDeleteComment = async (comment_id) => {
    if (!comment_id) {
      toast.error("Cannot delete: Comment ID is missing");
      return;
    }

    await confirmDialog({
      title: "Delete Comment",
      message: "Are you sure you want to delete this comment?",
      confirmText: "Delete",
      confirmLoadingText: "Deleting...",
      danger: true,
      onConfirmAction: async () => {
        try {

          // Call API
          await postAPI.deleteComment(comment_id);

          // Remove from state
          setComments((prev) => prev.filter((c) => c.comment_id !== comment_id));
          await loadComments();
          if (onCommentRemoved) {
            onCommentRemoved();
          }

          toast.success("Comment deleted");
        } catch (error) {
          console.error("❌ Failed to delete comment:", error);
          toast.error(error?.response?.data?.error || "Failed to delete comment");
          throw error;
        }
      },
    });
  };

  const handleEditComment = (comment) => {
    setEditingCommentId(comment.comment_id);
    setEditContent(comment.content);
  };

  const handleUpdateComment = async (comment) => {
    try {
      if (!comment.comment_id) {
        toast.error("Cannot update: Comment ID is missing");
        return;
      }
      if (!editContent.trim()) {
        toast.error("Comment content cannot be empty");
        return;
      }
      await postAPI.updateComment(comment.comment_id, { content: editContent });
      await loadComments();
      setEditingCommentId(null);
      setEditContent("");
      toast.success("Comment updated");
    } catch (error) {
      console.error("❌ Failed to update comment:", {
        commentId: comment.comment_id,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.response?.data?.message || error.message,
        url: error.config?.url,
        data: error.response?.data,
      });
      toast.error(error?.response?.data?.error || "Failed to update comment");
    }
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent("");
  };
  const handleReplySubmit = async (e, parentCommentId) => {
    if (readOnly) {
      return;
    }

    e.preventDefault();
    const content = replyContent[parentCommentId]?.trim();
    if (!content?.trim()) return;

    setLoading(true);
    try {
      await postAPI.addComment(postId, {
        content,
        parent_comment_id: parentCommentId,
      });

      await loadComments();
      if (onCommentAdded) {
        onCommentAdded();
      }

      // clear only this comment's reply input
      setReplyContent((prev) => ({ ...prev, [parentCommentId]: "" }));

      // close reply form if desired
      setReplyingComments((prev) => ({ ...prev, [parentCommentId]: false }));

      toast.success("Reply added!");
    } catch (error) {
      console.error("❌ Failed to reply:", error);
      toast.error(error?.response?.data?.error || "Failed to add reply");
    } finally {
      setLoading(false);
    }
  };

  const handleCommentLike = async (commentId) => {
    if (readOnly) {
      return;
    }

    try {
      if (!commentId) {
        console.error("❌ Comment ID is missing");
        toast.error("Cannot love comment: Comment ID is missing");
        return;
      }

      const response = await postAPI.likecomment(commentId);


      setComments((prevComments) =>
        prevComments.map((comment) =>
          comment.comment_id === commentId
            ? {
                ...comment,
                liked: response?.data?.liked ?? !comment.liked,
                likes_count:
                  typeof response?.data?.likes_count === "number"
                    ? response.data.likes_count
                    : comment.liked
                      ? comment.likes_count - 1
                      : comment.likes_count + 1,
              }
            : comment,
        ),
      );
    } catch (error) {
      console.error("❌ Failed to like comment:", {
        commentId,
        status: error.response?.status || "No response",
        statusText: error.response?.statusText || "",
        message:
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message,
        url: error.config?.url,
        method: error.config?.method,
        fullError: error,
      });

      if (error.response?.status === 404) {
        toast.error("Comment not found. It may have been deleted.");
      } else if (error.response?.status === 401) {
        toast.error("Please login to love comments");
      } else {
        toast.error(
          error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Failed to love comment",
        );
      }
    }
  };

  const commentMap = useMemo(() => {
    const map = new Map();
    comments.forEach((comment) => {
      map.set(Number(comment.comment_id), comment);
    });
    return map;
  }, [comments]);

  const repliesByParent = useMemo(() => {
    const grouped = new Map();

    comments.forEach((comment) => {
      const rawParent = comment.parent_comment_id;
      const normalizedParent = rawParent == null ? null : Number(rawParent);
      const parentKey =
        normalizedParent && commentMap.has(normalizedParent)
          ? normalizedParent
          : null;

      if (!grouped.has(parentKey)) {
        grouped.set(parentKey, []);
      }

      grouped.get(parentKey).push(comment);
    });

    grouped.forEach((commentList) => {
      commentList.sort((a, b) => {
        const aTime = toTimestamp(a.created_at);
        const bTime = toTimestamp(b.created_at);
        return aTime - bTime;
      });
    });

    return grouped;
  }, [comments, commentMap]);

  const renderCommentNode = (comment, depth = 0, visited = new Set()) => {
    const commentId = Number(comment.comment_id);
    if (!commentId || visited.has(commentId)) {
      return null;
    }

    const branchVisited = new Set(visited);
    branchVisited.add(commentId);

    const childComments = repliesByParent.get(commentId) || [];

    return (
      <div
        key={commentId}
        className="comment-thread"
        style={{ marginLeft: depth > 0 ? `${Math.min(depth, 4) * 24}px` : 0 }}
      >
        <div className="comment">
          <Avatar src={comment.user_profile_picture} name={comment.user_name} size={36} className="comment-avatar" decorative />

          <div className="comment-content">
            <div className="comment-header">
              <div className="comment-meta">
                <strong>{comment.user_name || "Unknown User"}</strong>
                <span className="comment-time">
                  {timeAgo(comment.created_at)}
                </span>
              </div>

              {user && Number(user.id) === Number(comment.user_id) && (
                <div className="comment-menu">
                  <button
                    className="comment-menu-trigger"
                    type="button"
                    aria-label="Comment actions"
                    aria-haspopup="menu"
                    aria-expanded={openMenuId === comment.comment_id}
                    onClick={() =>
                      setOpenMenuId(
                        openMenuId === comment.comment_id ? null : comment.comment_id,
                      )
                    }
                  >
                    <FaEllipsisH />
                  </button>

                  {openMenuId === comment.comment_id && (
                    <div className="comment-menu-dropdown" role="menu">
                      <button
                        type="button"
                        className="comment-menu-item"
                        onClick={() => handleEditComment(comment)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="comment-menu-item delete"
                        onClick={() => handleDeleteComment(comment.comment_id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

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

            <div className="comment-actions-row">
              <button
                className={`comment-like-btn ${comment.liked ? "liked" : ""}`}
                type="button"
                onClick={() => handleCommentLike(comment.comment_id)}
                aria-label={comment.liked ? "Remove love from comment" : "Love comment"}
                disabled={readOnly}
              >
                {comment.liked ? <FaHeart /> : <FaRegHeart />}
                <span className="comment-action-label">Love</span>
                {comment.likes_count > 0 ? (
                  <span className="count-pill">{comment.likes_count}</span>
                ) : null}
              </button>

              <button
                className="btn-reply"
                type="button"
                onClick={() => toggleReply(comment.comment_id)}
                disabled={readOnly}
              >
                {replyingComments[comment.comment_id] ? "Hide" : "Reply"}
              </button>
            </div>

            {!readOnly && replyingComments[comment.comment_id] && (
              <form
                className="edit-comment-form reply-box"
                onSubmit={(e) => handleReplySubmit(e, comment.comment_id)}
              >
                <textarea
                  value={replyContent[comment.comment_id] || ""}
                  onChange={(e) =>
                    setReplyContent((prev) => ({
                      ...prev,
                      [comment.comment_id]: e.target.value,
                    }))
                  }
                  rows="2"
                  placeholder="Write a reply..."
                />
                <div className="edit-actions reply-actions">
                  <button
                    type="submit"
                    className="save-btn reply-submit-btn"
                    disabled={loading}
                  >
                    Post
                  </button>

                  <button
                    type="button"
                    className="cancel-btn reply-cancel-btn"
                    onClick={() => toggleReply(comment.comment_id)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {childComments.length > 0 && (
          <div className="comment-children">
            {childComments.map((child) =>
              renderCommentNode(child, depth + 1, branchVisited),
            )}
          </div>
        )}
      </div>
    );
  };

  const topLevel = repliesByParent.get(null) || [];

  return (
    <div className="comments-section">
      {!readOnly && (
        <form onSubmit={handleSubmit} className="comment-form">
          <input
            type="text"
            placeholder="Write a comment..."
            aria-label="Write a comment"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <button type="submit" disabled={loading || !newComment.trim()}>
            {loading ? "Posting..." : "Post"}
          </button>
        </form>
      )}

      <div className="comments-list">
        {fetching ? (
          <div className="comments-loading" aria-busy="true" aria-label="Loading comments">
            {[0, 1].map((i) => (
              <div className="comment" key={i}>
                <span className="skel comment-skel-avatar" />
                <span className="skel comment-skel-body" />
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <p className="comments-note" role="alert">
            Couldn't load comments.{" "}
            <button type="button" className="comments-retry" onClick={() => { setFetching(true); loadComments(); }}>
              Try again
            </button>
          </p>
        ) : topLevel.length === 0 ? (
          <p className="comments-note">No comments yet. Start the conversation.</p>
        ) : (
          topLevel.map((comment) => renderCommentNode(comment))
        )}
      </div>
    </div>
  );
};

export default CommentSection;
