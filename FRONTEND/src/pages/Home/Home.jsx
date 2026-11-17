import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaBookOpen, FaComments, FaHome, FaPenFancy, FaStore, FaUsers, FaRegNewspaper, FaExclamationCircle } from 'react-icons/fa';
import { postAPI, userAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import CreatePost from '../../components/Posts/CreatePost';
import PostCard from '../../components/Posts/PostCard';
import PostSkeleton from '../../components/Posts/PostSkeleton';
import SuggestedUsers from '../../components/Users/SuggestedUsers';
import Avatar from '../../components/common/Avatar';
import { useAuth } from '../../context/AuthContext';
import '../../styles/Home.css';
import { toTimestamp } from '../../utils/time';

const Home = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [me, setMe] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [feedMode, setFeedMode] = useState('following');
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  const [activeHashtag, setActiveHashtag] = useState('');
  const [mediaFilter, setMediaFilter] = useState('all');

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    userAPI
      .getProfile(user.id)
      .then((response) => {
        if (!cancelled) setMe(response.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    loadFeed(1);
    loadTrendingHashtags();
  }, [feedMode, activeHashtag, mediaFilter]);

  const normalizePost = (post) => {
    const userFromObject = post.user || post.author || {};
    const normalizedHasLiked =
      post.has_liked ?? post.is_liked ?? post.liked ?? post.user_has_liked ?? false;
    const normalizedLikesCount = Number(post.likes_count) || 0;
    const normalizedCommentsCount = Number(post.comments_count) || 0;

    return {
      ...post,
      id: post.id || post.post_id,
      post_id: post.post_id || post.id,
      user_id:
        post.user_id ||
        post.author_id ||
        post.owner_id ||
        post.created_by ||
        post.created_by_id ||
        userFromObject.id,
      user_name:
        post.user_name ||
        post.author_name ||
        post.owner_name ||
        post.created_by_name ||
        post.username ||
        post.name ||
        userFromObject.name,
      profile_picture:
        post.profile_picture ||
        post.user_picture ||
        post.author_picture ||
        post.owner_picture ||
        post.created_by_picture ||
        userFromObject.profile_picture,
      has_liked: Boolean(normalizedHasLiked),
      likes_count: normalizedLikesCount,
      comments_count: normalizedCommentsCount,
    };
  };

  const extractPosts = (data) => {
    if (Array.isArray(data)) {
      return { items: data, next: null };
    }

    if (Array.isArray(data?.results)) {
      return { items: data.results, next: data.next };
    }

    if (Array.isArray(data?.posts)) {
      return { items: data.posts, next: data.next };
    }

    return { items: [], next: null };
  };

  const loadFeed = async (requestedPage = 1) => {
    try {
      setLoading(true);
      setError(false);
      let response;

      if (feedMode === 'trending') {
        response = await postAPI.getTrending();
      } else if (feedMode === 'hashtag' && activeHashtag) {
        response = await postAPI.getPostsByHashtag(activeHashtag);
      } else if (mediaFilter !== 'all') {
        response = await postAPI.getPostsByMediaType(mediaFilter, 30);
      } else {
        const [followingRes, publicRes] = await Promise.all([
          postAPI.getFeed(requestedPage),
          postAPI.getPublicPosts(30),
        ]);

        const followingItems = extractPosts(followingRes.data).items;
        const publicItems = extractPosts(publicRes.data).items;
        const mergedMap = new Map();

        [...followingItems, ...publicItems].forEach((item) => {
          const normalized = normalizePost(item);
          const key = normalized.id || normalized.post_id;
          if (key) {
            mergedMap.set(key, normalized);
          }
        });

        const mergedPosts = Array.from(mergedMap.values()).sort((a, b) => {
          const aTime = toTimestamp(a.created_at);
          const bTime = toTimestamp(b.created_at);
          return bTime - aTime;
        });

        setPosts(mergedPosts);
        setHasMore(false);
        setPage(requestedPage);
        return;
      }

      const { items, next } = extractPosts(response.data);
      const normalizedPosts = items.map(normalizePost);
      setPosts(normalizedPosts);
      setHasMore(feedMode === 'following' && mediaFilter === 'all' ? !!next : false);
      setPage(requestedPage);
    } catch (error) {
      console.error('Error loading feed:', error);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadTrendingHashtags = async () => {
    try {
      const response = await postAPI.getTrendingHashtags(10);
      const items = Array.isArray(response.data)
        ? response.data
        : response.data?.results || [];
      setTrendingHashtags(items);
    } catch (error) {
      setTrendingHashtags([]);
    }
  };

  const handlePostCreated = (newPost) => {
    const normalizedPost = normalizePost(newPost);
    setPosts([normalizedPost, ...posts]);
  };

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  };

  // PostCard reports the server's final state; fall back to a toggle if it is missing.
  const handlePostLike = (postId, liked, likesCount) => {
    setPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id !== postId) {
          return post;
        }

        if (typeof liked === 'boolean') {
          return { ...post, has_liked: liked, likes_count: likesCount };
        }

        const wasLiked = Boolean(post.has_liked);
        const currentLikes = Number(post.likes_count) || 0;

        return {
          ...post,
          has_liked: !wasLiked,
          likes_count: wasLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1,
        };
      }),
    );
  };

  const loadMore = async () => {
    try {
      const nextPage = page + 1;
      const response = await postAPI.getFeed(nextPage);
      const { items, next } = extractPosts(response.data);
      const normalizedPosts = items.map(normalizePost);
      setPosts([...posts, ...normalizedPosts]);
      setPage(nextPage);
      setHasMore(!!next);
    } catch (error) {
      console.error('Error loading more posts:', error);
    }
  };

  const switchMode = (mode) => {
    setFeedMode(mode);
    if (mode !== 'hashtag') {
      setActiveHashtag('');
    }
  };

  const applyHashtag = (tag) => {
    const normalizedTag = String(tag || '').replace(/^#/, '').trim();
    if (!normalizedTag) return;
    setActiveHashtag(normalizedTag);
    setFeedMode('hashtag');
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container">
          <div className="home-layout">
            <aside className="left-rail" aria-label="Shortcuts">
              <div className="left-rail-card">
                <Link to={`/profile/${user?.id}`} className="left-rail-profile">
                  <Avatar src={me?.profile_picture} name={me?.name} size={44} decorative />
                  <span className="left-rail-profile-text">
                    <strong>{me?.name || 'Your profile'}</strong>
                    <span>{me?.department_name || 'View your profile'}</span>
                  </span>
                </Link>
                <nav className="shortcut-list" aria-label="Sections">
                  <Link to="/" className="shortcut-item">
                    <FaHome />
                    <span>News Feed</span>
                  </Link>
                  <Link to="/groups" className="shortcut-item">
                    <FaUsers />
                    <span>Groups</span>
                  </Link>
                  <Link to="/chat" className="shortcut-item">
                    <FaComments />
                    <span>Messages</span>
                  </Link>
                  <Link to="/marketplace" className="shortcut-item">
                    <FaStore />
                    <span>Marketplace</span>
                  </Link>
                  <Link to="/blogs" className="shortcut-item">
                    <FaPenFancy />
                    <span>Blogs</span>
                  </Link>
                  <Link to="/forums" className="shortcut-item">
                    <FaBookOpen />
                    <span>Forums</span>
                  </Link>
                </nav>
              </div>
            </aside>

            <main className="feed-section">
              <h1 className="sr-only">Home feed</h1>
              <div className="feed-filters" role="toolbar" aria-label="Feed filters">
                <button type="button" className={`filter-chip ${feedMode === 'following' ? 'active' : ''}`} aria-pressed={feedMode === 'following'} onClick={() => switchMode('following')}>
                  Following
                </button>
                <button type="button" className={`filter-chip ${feedMode === 'trending' ? 'active' : ''}`} aria-pressed={feedMode === 'trending'} onClick={() => switchMode('trending')}>
                  Trending
                </button>
                {activeHashtag && (
                  <button type="button" className={`filter-chip ${feedMode === 'hashtag' ? 'active' : ''}`} aria-pressed={feedMode === 'hashtag'} onClick={() => switchMode('hashtag')}>
                    #{activeHashtag}
                  </button>
                )}
                <select
                  className="filter-chip filter-select"
                  aria-label="Filter by media type"
                  value={mediaFilter}
                  onChange={(e) => {
                    setMediaFilter(e.target.value);
                    setFeedMode('following');
                  }}
                >
                  <option value="all">All media</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                  <option value="text">Text</option>
                </select>
              </div>

              <CreatePost onPostCreated={handlePostCreated} currentUser={me} />

              {loading ? (
                <div aria-busy="true" aria-label="Loading feed">
                  <PostSkeleton withMedia />
                  <PostSkeleton />
                  <PostSkeleton />
                </div>
              ) : error ? (
                <div className="state-card" role="alert">
                  <FaExclamationCircle aria-hidden="true" />
                  <strong>Couldn't load your feed</strong>
                  <p>Check your connection and try again.</p>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadFeed(1)}>
                    Try again
                  </button>
                </div>
              ) : posts.length === 0 ? (
                <div className="state-card">
                  <FaRegNewspaper aria-hidden="true" />
                  <strong>
                    {feedMode === 'hashtag' ? `No posts tagged #${activeHashtag} yet` : 'Nothing here yet'}
                  </strong>
                  <p>
                    {feedMode === 'following'
                      ? 'Follow people from the suggestions, or share the first post yourself.'
                      : 'Check back soon, or switch to another feed.'}
                  </p>
                </div>
              ) : (
                <>
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onLike={handlePostLike}
                      onDelete={handlePostDeleted}
                    />
                  ))}
                  {hasMore && feedMode === 'following' && mediaFilter === 'all' && (
                    <button onClick={loadMore} className="btn btn-secondary load-more">
                      Load more posts
                    </button>
                  )}
                </>
              )}
            </main>

            <aside className="sidebar" aria-label="Discover">
              <SuggestedUsers />
              <div className="sidebar-card">
                <h3>Trending hashtags</h3>
                {trendingHashtags.length === 0 ? (
                  <p className="text-muted">No hashtag trends yet</p>
                ) : (
                  <div className="hashtag-list">
                    {trendingHashtags.map((item, index) => {
                      const tag = item.hashtag || item.tag || item.name;
                      if (!tag) return null;
                      return (
                        <button
                          key={`${tag}-${index}`}
                          type="button"
                          className="hashtag-chip"
                          onClick={() => applyHashtag(tag)}
                        >
                          <span className="hashtag-chip-tag">#{tag}</span>
                          <span className="hashtag-chip-meta">
                            {item.post_count ?? 0} posts · {item.total_engagement ?? 0} reactions
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
