import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FaSearch, FaTimes, FaHistory, FaExclamationCircle, FaUserFriends, FaRegNewspaper, FaUsers, FaStore,
} from 'react-icons/fa';
import { userAPI, postAPI, groupAPI, marketplaceAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import Avatar from '../../components/common/Avatar';
import GroupCard from '../../components/groups/GroupCard';
import ProductCard from '../../components/marketplace/ProductCard';
import { getProductId } from '../../components/marketplace/productUtils';
import { formatDate } from '../../utils/time';
import '../../styles/Search.css';

const RECENT_KEY = 'csb-recent-searches';
const RECENT_LIMIT = 6;
const PREVIEW_COUNT = 4;

const readRecent = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const writeRecent = (items) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items));
  } catch {
    // Storage can be unavailable (private mode); recents are a convenience only.
  }
};

const getGroupId = (group) => group?.group_id || group?.id || group?.pk;

const excerpt = (text, max = 180) => {
  const value = String(text || '').trim();
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
};

const TABS = [
  ['all', 'All'],
  ['users', 'People'],
  ['posts', 'Posts'],
  ['groups', 'Groups'],
  ['products', 'Marketplace'],
];

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();

  const [input, setInput] = useState(query);
  const [recent, setRecent] = useState(readRecent);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const requestIdRef = useRef(0);
  const inputRef = useRef(null);

  useEffect(() => {
    setInput(query);
  }, [query]);

  const rememberSearch = useCallback((term) => {
    setRecent((prev) => {
      const next = [term, ...prev.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, RECENT_LIMIT);
      writeRecent(next);
      return next;
    });
  }, []);

  const performSearch = useCallback(async (term) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setFailed(false);

    let failures = 0;
    const settle = (request) =>
      request.catch(() => {
        failures += 1;
        return { data: { results: [] } };
      });

    const [usersRes, postsRes, groupsRes, productsRes] = await Promise.all([
      settle(userAPI.searchUsers(term)),
      settle(postAPI.searchPosts(term)),
      settle(groupAPI.searchGroups(term)),
      settle(marketplaceAPI.searchProducts(term)),
    ]);

    // Ignore answers that arrive after a newer search started.
    if (requestId !== requestIdRef.current) return;

    setUsers(usersRes.data.results || []);
    setPosts(postsRes.data.results || []);
    setGroups(groupsRes.data.results || []);
    setProducts(productsRes.data.results || []);
    setFailed(failures === 4);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (query) {
      rememberSearch(query);
      performSearch(query);
    } else {
      requestIdRef.current += 1;
      setLoading(false);
      setUsers([]);
      setPosts([]);
      setGroups([]);
      setProducts([]);
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const submit = (term) => {
    const value = term.trim();
    if (!value) return;
    setActiveTab('all');
    setSearchParams({ q: value });
  };

  const counts = { users: users.length, posts: posts.length, groups: groups.length, products: products.length };
  const total = counts.users + counts.posts + counts.groups + counts.products;

  const renderUsers = (list) => (
    <ul className="people-grid">
      {list.map((person) => (
        <li key={person.id}>
          <Link to={`/profile/${person.id}`} className="person-card">
            <Avatar src={person.profile_picture} name={person.name} size={56} decorative />
            <span className="person-name">{person.name}</span>
            <span className="person-meta">
              {[person.department_name, person.batch ? `Batch ${person.batch}` : null].filter(Boolean).join(' · ') || 'BUET'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );

  const renderPosts = (list) => (
    <ul className="result-posts">
      {list.map((post) => (
        <li key={post.id}>
          <Link to={`/posts/${post.id}`} className="result-post">
            <Avatar src={post.author_picture} name={post.author_name} size={36} decorative />
            <span className="result-post-body">
              <span className="result-post-head">
                <strong>{post.author_name}</strong>
                <span>{formatDate(post.created_at)}</span>
              </span>
              <span className="result-post-text">{excerpt(post.content)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );

  const renderGroups = (list) => (
    <div className="result-grid">
      {list.map((group) => {
        const groupId = getGroupId(group);
        if (!groupId) return null;
        const isAcceptedMember =
          group?.is_member === true ||
          group?.membership_status === 'accepted' ||
          group?.member_status === 'accepted';
        return (
          <GroupCard
            key={groupId}
            group={group}
            groupId={groupId}
            to={isAcceptedMember ? `/groups/${groupId}` : `/groups/${groupId}/nonmember`}
          />
        );
      })}
    </div>
  );

  const renderProducts = (list) => (
    <div className="result-grid">
      {list.map((product) => {
        const productId = getProductId(product);
        if (!productId) return null;
        return <ProductCard key={productId} product={product} />;
      })}
    </div>
  );

  const sections = [
    { id: 'users', title: 'People', icon: FaUserFriends, items: users, render: renderUsers, empty: 'No people found' },
    { id: 'posts', title: 'Posts', icon: FaRegNewspaper, items: posts, render: renderPosts, empty: 'No posts found' },
    { id: 'groups', title: 'Groups', icon: FaUsers, items: groups, render: renderGroups, empty: 'No groups found' },
    { id: 'products', title: 'Marketplace', icon: FaStore, items: products, render: renderProducts, empty: 'No listings found' },
  ];

  const renderResults = () => {
    if (activeTab === 'all') {
      return sections
        .filter((section) => section.items.length > 0)
        .map((section) => (
          <section className="search-section" key={section.id} aria-labelledby={`search-${section.id}`}>
            <div className="search-section-head">
              <h2 id={`search-${section.id}`}>
                {section.title} <span>{section.items.length}</span>
              </h2>
              {section.items.length > PREVIEW_COUNT && (
                <button type="button" className="inline-link-btn" onClick={() => setActiveTab(section.id)}>
                  See all
                </button>
              )}
            </div>
            {section.render(section.items.slice(0, PREVIEW_COUNT))}
          </section>
        ));
    }

    const section = sections.find((item) => item.id === activeTab);
    if (!section) return null;
    return section.items.length === 0 ? (
      <div className="state-card">
        <section.icon aria-hidden="true" />
        <strong>{section.empty}</strong>
        <p>Try a different spelling, or search with fewer words.</p>
      </div>
    ) : (
      section.render(section.items)
    );
  };

  const renderBody = () => {
    if (!query) {
      return (
        <div className="search-start">
          {recent.length > 0 ? (
            <section aria-labelledby="recent-title">
              <div className="search-section-head">
                <h2 id="recent-title">Recent searches</h2>
                <button
                  type="button"
                  className="inline-link-btn"
                  onClick={() => {
                    setRecent([]);
                    writeRecent([]);
                  }}
                >
                  Clear
                </button>
              </div>
              <ul className="recent-list">
                {recent.map((term) => (
                  <li key={term}>
                    <button type="button" onClick={() => submit(term)}>
                      <FaHistory aria-hidden="true" /> {term}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <div className="state-card">
              <FaSearch aria-hidden="true" />
              <strong>Search the BUET community</strong>
              <p>Find people, posts, groups and marketplace listings. Try a name, a hashtag or a course.</p>
            </div>
          )}
        </div>
      );
    }

    if (loading) {
      return (
        <div aria-busy="true" aria-label="Searching">
          <ul className="people-grid" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="person-card person-skeleton">
                <span className="skel person-skel-avatar" />
                <span className="skel person-skel-line" />
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (failed) {
      return (
        <div className="state-card" role="alert">
          <FaExclamationCircle aria-hidden="true" />
          <strong>Search isn't working right now</strong>
          <p>Check your connection and try again.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => performSearch(query)}>
            Try again
          </button>
        </div>
      );
    }

    if (total === 0) {
      return (
        <div className="state-card">
          <FaSearch aria-hidden="true" />
          <strong>No results for "{query}"</strong>
          <p>Check the spelling, or try a shorter or more general search.</p>
        </div>
      );
    }

    return renderResults();
  };

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="search-container">
          <h1 className="sr-only">Search</h1>

          <form
            className="search-box"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
          >
            <FaSearch aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search the community"
              aria-label="Search"
              enterKeyHint="search"
            />
            {input && (
              <button
                type="button"
                className="search-clear"
                aria-label="Clear search"
                onClick={() => {
                  setInput('');
                  inputRef.current?.focus();
                }}
              >
                <FaTimes aria-hidden="true" />
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-sm" disabled={!input.trim()}>
              Search
            </button>
          </form>

          {query && !loading && !failed && total > 0 && (
            <div className="search-tabs" role="tablist" aria-label="Result types">
              {TABS.map(([id, label]) => {
                const count = id === 'all' ? total : counts[id];
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === id}
                    className={`tab-btn ${activeTab === id ? 'active' : ''}`}
                    onClick={() => setActiveTab(id)}
                  >
                    {label} <span className="tab-count">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="search-results" aria-live="polite">
            {renderBody()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Search;
