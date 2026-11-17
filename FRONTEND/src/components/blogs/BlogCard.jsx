import React from 'react';
import { Link } from 'react-router-dom';
import { FaEdit, FaTrash, FaEye, FaHeart } from 'react-icons/fa';
import GroupCover from '../groups/GroupCover';
import { formatDate, formatDateTime } from '../../utils/time';

const initialOf = (title) => String(title || '?').trim()[0]?.toUpperCase() || '?';

/**
 * A blog in the grid. Drafts and not-yet-published posts are "locked": they show
 * their status instead of linking to the article.
 */
const BlogCard = ({
  blog,
  blogId,
  locked,
  isDraft,
  canEdit,
  canDelete,
  deleting,
  onOpen,
  onEdit,
  onDelete,
}) => {
  const excerpt = blog.excerpt || String(blog.content || '').slice(0, 140);

  return (
    <article className={`blog-card ${locked ? 'is-locked' : ''}`}>
      <GroupCover src={blog.cover_image} seed={blogId} className="blog-card-cover">
        {!blog.cover_image && <span className="blog-cover-initial" aria-hidden="true">{initialOf(blog.title)}</span>}
        {blog.category && <span className="blog-cover-badge">{blog.category}</span>}
      </GroupCover>

      <div className="blog-card-content">
        {locked && (
          <span className="blog-status-chip">
            {isDraft ? 'Draft' : `Scheduled · ${formatDateTime(blog.scheduled_publish_at)}`}
          </span>
        )}

        <h3>
          {locked ? (
            blog.title
          ) : (
            <Link to={`/blogs/${blogId}`} onClick={(event) => onOpen(event, blogId)}>
              {blog.title}
            </Link>
          )}
        </h3>

        {excerpt && <p className="blog-card-excerpt">{excerpt}</p>}

        <div className="blog-card-footer">
          <span className="blog-card-author">{blog.author_name || 'Unknown'}</span>
          <span className="blog-card-date">{formatDate(blog.published_at || blog.created_at)}</span>
          <span className="blog-card-stats">
            <FaEye aria-hidden="true" /> {blog.views_count || 0}
            <FaHeart aria-hidden="true" /> {blog.likes_count || 0}
          </span>
        </div>
      </div>

      {(canEdit || canDelete) && (
        <div className="blog-card-actions">
          {canEdit && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEdit(blog)}>
              <FaEdit aria-hidden="true" /> Edit
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-quiet-danger"
              onClick={() => onDelete(blogId)}
              disabled={deleting}
            >
              <FaTrash aria-hidden="true" /> {deleting ? 'Deleting' : 'Delete'}
            </button>
          )}
        </div>
      )}
    </article>
  );
};

export default BlogCard;
