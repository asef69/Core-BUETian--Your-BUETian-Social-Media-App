import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { blogAPI, postAPI } from '../../services/apiService';
import { showToast } from '../../utils/toast.jsx';
import { confirmDialog } from '../../utils/confirmDialog';
import { useAuth } from '../../context/AuthContext';
import { FaImage, FaPlus, FaSearch, FaTimes, FaRegCalendarAlt, FaPenNib, FaExclamationCircle } from 'react-icons/fa';
import BlogCard from '../../components/blogs/BlogCard';
import { validateImageFile } from '../../utils/validation';
import '../../styles/Blogs.css';
import { formatDateTime, dhakaInputToISO, toDhakaInputValue, toTimestamp } from '../../utils/time';

const BLOG_CATEGORIES = [
  'Technology',
  'Academics',
  'Campus Life',
  'Career & Internship',
  'Research',
  'Events',
  'Clubs & Societies',
  'Study Resources',
  'Personal Development',
  'Alumni Stories',
  'Entrepreneurship',
  'Announcements',
];


const Blogs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [categoryMode, setCategoryMode] = useState('preset');
  const [customCategory, setCustomCategory] = useState('');
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState('');
  const [creating, setCreating] = useState(false);
  const [createData, setCreateData] = useState({
    title: '',
    excerpt: '',
    content: '',
    category: BLOG_CATEGORIES[0],
    tags: '',
    is_published: true,
    scheduled_publish_at: '',
  });
  const [tab, setTab] = useState('all'); // 'all' or 'drafts'
  const [editingBlog, setEditingBlog] = useState(null);
  const [deletingBlogId, setDeletingBlogId] = useState(null);
  const scheduleInputRef = useRef(null);
  const tagFilter = String(searchParams.get('tag') || '').replace(/^#/, '').trim();
  const currentUserId = user?.id;

  const handleEditBlog = (blog) => {
    const categoryValue = blog.category || BLOG_CATEGORIES[0];
    const isPresetCategory = BLOG_CATEGORIES.includes(categoryValue);

    setEditingBlog(blog);
    setShowCreateModal(true);
    setCategoryMode(isPresetCategory ? 'preset' : 'custom');
    setCustomCategory(isPresetCategory ? '' : categoryValue);
    setCoverImageFile(null);
    setCoverImagePreview(blog.cover_image || '');

    setCreateData({
      title: blog.title || '',
      excerpt: blog.excerpt || '',
      content: blog.content || '',
      category: isPresetCategory ? categoryValue : BLOG_CATEGORIES[0],
      tags: Array.isArray(blog.tags) ? blog.tags.join(', ') : String(blog.tags || ''),
      is_published: blog.is_published,
      scheduled_publish_at: toDhakaInputValue(blog.scheduled_publish_at),
    });
  };

  const handleDeleteBlog = async (blogId) => {
    await confirmDialog({
      title: 'Delete Blog Post',
      message: 'Are you sure you want to delete this blog post?',
      confirmText: 'Delete',
      confirmLoadingText: 'Deleting...',
      danger: true,
      onConfirmAction: async () => {
        setDeletingBlogId(blogId);
        try {
          await blogAPI.deleteBlog(blogId);
          showToast.success('Post deleted', 'Blog post has been removed');
          setBlogs((prev) => prev.filter((b) => getBlogId(b) !== blogId));
        } catch (error) {
          showToast.error('Delete failed', error?.response?.data?.error || 'Failed to delete blog post');
          throw error;
        } finally {
          setDeletingBlogId(null);
        }
      },
    });
  };

  // Fetch blogs for the selected tab
  const loadBlogs = async (selectedTab = tab, selectedTag = tagFilter) => {
    try {
      setLoading(true);
      setLoadError(false);
      let response;
      if (selectedTab === 'drafts') {
        response = await blogAPI.getMyBlogs({ mine: true, drafts_tab: true });
      } else {
        const params = selectedTag ? { tag: selectedTag } : {};
        response = await blogAPI.getPublishedBlogs(params);
      }
      const items = Array.isArray(response.data)
        ? response.data
        : response.data?.results || [];
      setBlogs(items);
    } catch (error) {
      showToast.error('Failed to load', 'Could not retrieve blog posts');
      setBlogs([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlogs(tab, tagFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tagFilter]);

  useEffect(() => {
    const editBlogFromState = location.state?.editBlog;
    if (!editBlogFromState) return;

    handleEditBlog(editBlogFromState);
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: null },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, location.pathname, location.search, navigate]);

  const getBlogId = (blog) => blog?.blog_id || blog?.id || blog?.pk;

  const filteredBlogs = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return blogs;
    return blogs.filter((blog) => {
      const title = String(blog.title || '').toLowerCase();
      const excerpt = String(blog.excerpt || '').toLowerCase();
      const author = String(blog.author_name || '').toLowerCase();
      const category = String(blog.category || '').toLowerCase();
      return title.includes(query) || excerpt.includes(query) || author.includes(query) || category.includes(query);
    });
  }, [blogs, searchText]);

  const handleCreateBlog = async (e) => {
    e.preventDefault();
    setCreating(true);

    const editingBlogId = getBlogId(editingBlog);
    const isEditing = Boolean(editingBlogId);

    const normalizedCategory = categoryMode === 'custom'
      ? customCategory.trim()
      : createData.category;

    let uploadedCoverImage = null;

    if (coverImageFile) {
      const coverFormData = new FormData();
      coverFormData.append('media', coverImageFile);
      coverFormData.append('media_type', 'image');

      try {
        const uploadRes = await postAPI.uploadMedia(coverFormData);
        const uploadedFiles = Array.isArray(uploadRes.data?.uploaded_files)
          ? uploadRes.data.uploaded_files
          : [];

        uploadedCoverImage = uploadedFiles[0]?.url || null;
      } catch (error) {
        showToast.error('Upload failed', error?.response?.data?.error || 'Failed to upload cover image');
        setCreating(false);
        return;
      }
    }

    const tags = createData.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const scheduledInput = createData.scheduled_publish_at;
    const parsedSchedule =
      dhakaInputToISO(scheduledInput);

    // Checkbox takes precedence. If publish-now is enabled, ignore any schedule value.
    const publishImmediately = Boolean(createData.is_published);
    const effectiveSchedule = publishImmediately ? null : parsedSchedule;
    const effectiveIsPublished = publishImmediately || Boolean(effectiveSchedule);

    const payload = {
      title: createData.title,
      excerpt: createData.excerpt || null,
      content: createData.content,
      category: normalizedCategory || null,
      cover_image: uploadedCoverImage || (isEditing ? (editingBlog?.cover_image || null) : null),
      is_published: effectiveIsPublished,
      tags,
      scheduled_publish_at: effectiveSchedule,
    };

    try {
      if (isEditing) {
        await blogAPI.updateBlog(editingBlogId, payload);
        showToast.success('Post updated', 'Your blog post has been updated');
      } else {
        await blogAPI.createBlog(payload);
        showToast.success('Post created', 'Your blog post is now live');
      }

      setShowCreateModal(false);
      setEditingBlog(null);
      setCreateData({
        title: '',
        excerpt: '',
        content: '',
        category: BLOG_CATEGORIES[0],
        tags: '',
        is_published: true,
        scheduled_publish_at: '',
      });
      setCategoryMode('preset');
      setCustomCategory('');
      setCoverImageFile(null);
      setCoverImagePreview('');
      loadBlogs();
    } catch (error) {
      showToast.error(
        isEditing ? 'Update failed' : 'Creation failed',
        error?.response?.data?.error || (isEditing ? 'Failed to update blog post' : 'Failed to create blog post')
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCoverImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      showToast.error('Invalid image', validation.error);
      return;
    }

    setCoverImagePreview((previous) => {
      if (previous && previous.startsWith('blob:')) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
    setCoverImageFile(file);
  };

  const handleBlogCardClick = async (event, blogId) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();

    try {
      const response = await blogAPI.trackView(blogId);
      const nextViews = response?.data?.views_count;

      if (typeof nextViews === 'number') {
        setBlogs((currentBlogs) => currentBlogs.map((blog) => {
          if (getBlogId(blog) !== blogId) return blog;
          return {
            ...blog,
            views_count: nextViews,
          };
        }));
      }

      navigate(`/blogs/${blogId}`, { state: { viewTracked: true } });
    } catch (error) {
      navigate(`/blogs/${blogId}`);
    }
  };

  const openCreateModal = () => {
    setEditingBlog(null);
    setCategoryMode('preset');
    setCustomCategory('');
    setCoverImageFile(null);
    setCoverImagePreview('');
    setCreateData({
      title: '',
      excerpt: '',
      content: '',
      category: BLOG_CATEGORIES[0],
      tags: '',
      is_published: true,
      scheduled_publish_at: '',
    });
    setShowCreateModal(true);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingBlog(null);
  };

  useEffect(() => {
    if (!showCreateModal) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowCreateModal(false);
        setEditingBlog(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showCreateModal]);

  const renderGrid = () => {
    if (loading) {
      return (
        <div className="blogs-grid" aria-busy="true" aria-label="Loading blogs">
          {[0, 1, 2].map((i) => (
            <div className="blog-card" key={i} aria-hidden="true">
              <span className="skel blog-skel-cover" />
              <div className="blog-card-content">
                <span className="skel blog-skel-line" style={{ width: '75%', height: 16 }} />
                <span className="skel blog-skel-line" style={{ width: '95%' }} />
                <span className="skel blog-skel-line" style={{ width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="state-card" role="alert">
          <FaExclamationCircle aria-hidden="true" />
          <strong>Couldn't load blog posts</strong>
          <p>Check your connection and try again.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadBlogs()}>
            Try again
          </button>
        </div>
      );
    }

    if (filteredBlogs.length === 0) {
      return (
        <div className="state-card">
          <FaPenNib aria-hidden="true" />
          <strong>
            {searchText.trim()
              ? 'No posts match your search'
              : tab === 'drafts'
                ? 'No drafts yet'
                : 'No blog posts yet'}
          </strong>
          <p>
            {searchText.trim()
              ? 'Try a different word, or clear the search.'
              : tab === 'drafts'
                ? 'Posts you save as drafts or schedule will appear here.'
                : 'Be the first to share a story, tutorial or idea.'}
          </p>
          {!searchText.trim() && (
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreateModal}>
              Write a post
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="blogs-grid">
        {filteredBlogs.map((blog) => {
          const blogId = getBlogId(blog);
          if (!blogId) return null;

          const isAuthor = String(blog.author_id) === String(currentUserId);
          const canEdit = Boolean(blog.can_edit ?? isAuthor);
          const canDelete = Boolean(blog.can_delete ?? isAuthor);
          const isDraft = !blog.is_published;
          const isScheduledFuture =
            Boolean(blog.scheduled_publish_at) && toTimestamp(blog.scheduled_publish_at) > Date.now();

          return (
            <BlogCard
              key={blogId}
              blog={blog}
              blogId={blogId}
              locked={isDraft || isScheduledFuture}
              isDraft={isDraft}
              canEdit={tab === 'drafts' && canEdit}
              canDelete={canDelete}
              deleting={deletingBlogId === blogId}
              onOpen={handleBlogCardClick}
              onEdit={handleEditBlog}
              onDelete={handleDeleteBlog}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container blogs-page">
          <div className="blogs-header">
            <div>
              <h1>Blogs</h1>
              <p className="page-subtitle">Long-form posts, tutorials and ideas from the community.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={openCreateModal}>
              <FaPlus aria-hidden="true" /> Write a post
            </button>
          </div>

          <div className="blogs-toolbar">
            <div className="blogs-tabs" role="tablist" aria-label="Blog lists">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'all'}
                className={`blogs-tab ${tab === 'all' ? 'active' : ''}`}
                onClick={() => setTab('all')}
              >
                All blogs
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'drafts'}
                className={`blogs-tab ${tab === 'drafts' ? 'active' : ''}`}
                onClick={() => setTab('drafts')}
              >
                My drafts
              </button>
            </div>

            <div className="blogs-search">
              <FaSearch aria-hidden="true" />
              <input
                type="search"
                placeholder={tab === 'drafts' ? 'Search your drafts' : 'Search title, author, category'}
                aria-label="Search blogs"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </div>

          {tagFilter && (
            <div className="blog-tag-filter">
              <span className="blog-tag">#{tagFilter}</span>
              <button type="button" className="inline-link-btn" onClick={() => setSearchParams({})}>
                Clear tag filter
              </button>
            </div>
          )}

          {renderGrid()}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-content large blog-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="blog-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="blog-modal-header">
              <div className="blog-modal-header-flex">
                <div>
                  <h2 className="blog-modal-title" id="blog-modal-title">{editingBlog ? 'Edit Blog Post' : 'Create Blog Post'}</h2>
                  <p className="blog-modal-subtitle">
                    {editingBlog ? 'Update your post details' : 'Share your ideas with the BUET community'}
                  </p>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  aria-label="Close"
                  onClick={closeModal}
                >
                  <FaTimes />
                </button>
              </div>
              <form onSubmit={handleCreateBlog} className="blog-create-form animate-fade-in">
                <div className="form-group">
                  <label htmlFor="blog-title">Title</label>
                  <input
                    id="blog-title"
                    type="text"
                    className="input-lg"
                    value={createData.title}
                    onChange={(e) => setCreateData({ ...createData, title: e.target.value })}
                    required
                    maxLength={120}
                    placeholder="Enter a catchy title"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="blog-excerpt">Short Summary <span className="optional">(Optional)</span></label>
                  <textarea
                    id="blog-excerpt"
                    rows="2"
                    className="input-md"
                    value={createData.excerpt}
                    onChange={(e) => setCreateData({ ...createData, excerpt: e.target.value })}
                    placeholder="Write 1-2 lines that describe your blog. This will show on the blog card."
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="blog-content">Content</label>
                  <textarea
                    id="blog-content"
                    rows="8"
                    className="input-md"
                    value={createData.content}
                    onChange={(e) => setCreateData({ ...createData, content: e.target.value })}
                    required
                    placeholder="Write your blog post here..."
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <div className="blog-cat-toggle">
                      <button
                        type="button"
                        className={`blog-cat-option${categoryMode === 'preset' ? ' active' : ''}`}
                        onClick={() => setCategoryMode('preset')}
                        tabIndex={0}
                      >
                        Choose from list
                      </button>
                      <button
                        type="button"
                        className={`blog-cat-option${categoryMode === 'custom' ? ' active' : ''}`}
                        onClick={() => setCategoryMode('custom')}
                        tabIndex={0}
                      >
                        Custom
                      </button>
                    </div>
                    {categoryMode === 'preset' ? (
                      <select
                        className="input-md"
                        value={createData.category}
                        onChange={(e) => setCreateData({ ...createData, category: e.target.value })}
                      >
                        {BLOG_CATEGORIES.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="input-md"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="e.g. Open Source, Mental Health"
                        required
                      />
                    )}
                  </div>
                  <div className="form-group">
                    <label>Cover Image <span className="optional">(Optional)</span></label>
                    {coverImagePreview ? (
                      <div className="blog-upload-preview-wrap animate-fade-in">
                        <img src={coverImagePreview} alt="Cover preview" className="blog-cover-preview" />
                        <button
                          type="button"
                          className="blog-upload-remove"
                          onClick={() => { setCoverImageFile(null); setCoverImagePreview(''); }}
                        >
                          <FaTimes /> Remove
                        </button>
                      </div>
                    ) : (
                      <label className="blog-upload-zone">
                        <FaImage className="blog-upload-icon" />
                        <span>Click to upload a cover photo</span>
                        <span className="blog-upload-hint">JPG, PNG, GIF, WEBP &mdash; max 5 MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverImageChange}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="blog-tags">Tags <span className="optional">(comma separated)</span></label>
                  <input
                    id="blog-tags"
                    type="text"
                    className="input-md"
                    value={createData.tags}
                    onChange={(e) => setCreateData({ ...createData, tags: e.target.value })}
                    placeholder="react, django, buet"
                  />
                </div>
                <div className="form-group form-toggle">
                  <button
                    id="blog-publish"
                    type="button"
                    className={`publish-toggle ${createData.is_published ? 'active' : ''}`}
                    onClick={() => {
                      const nextPublished = !createData.is_published;
                      setCreateData({
                        ...createData,
                        is_published: nextPublished,
                        scheduled_publish_at: nextPublished ? '' : createData.scheduled_publish_at,
                      });
                    }}
                    aria-pressed={createData.is_published}
                    aria-label="Toggle publish immediately"
                  >
                    <span className="toggle-knob" />
                    <span className="toggle-label">
                      {createData.is_published ? 'Publish immediately' : 'Save as draft'}
                    </span>
                  </button>
                </div>
                <div className="form-group">
                  <label htmlFor="blog-schedule">Schedule publish date <span className="optional">(Optional)</span></label>
                  <div className="schedule-input-wrap">
                    <input
                      ref={scheduleInputRef}
                      id="blog-schedule"
                      type="datetime-local"
                      className="input-md schedule-input"
                      value={createData.scheduled_publish_at}
                      disabled={createData.is_published}
                      onChange={(e) => setCreateData({ ...createData, scheduled_publish_at: e.target.value })}
                    />
                    <button
                      type="button"
                      className="schedule-picker-btn"
                      disabled={createData.is_published}
                      aria-label="Open date and time picker"
                      onClick={() => {
                        const inputEl = scheduleInputRef.current;
                        if (!inputEl) return;
                        if (typeof inputEl.showPicker === 'function') {
                          inputEl.showPicker();
                          return;
                        }
                        inputEl.focus();
                      }}
                    >
                      <FaRegCalendarAlt aria-hidden="true" />
                    </button>
                  </div>
                  <small className="form-hint">
                    {createData.is_published
                      ? 'Scheduling is disabled while Publish immediately is enabled.'
                      : 'Leave blank to keep it as draft. If set, the blog will be published at this date and time (Bangladesh time, UTC+6).'}
                  </small>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-primary btn-lg" type="submit" disabled={creating}>
                    {creating ? (editingBlog ? 'Updating...' : 'Publishing...') : (editingBlog ? 'Update Blog' : 'Publish Blog')}
                  </button>
                  <button
                    className="btn btn-secondary btn-lg"
                    type="button"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
          </div>
        )}
    </div>
  );
};

export default Blogs;
