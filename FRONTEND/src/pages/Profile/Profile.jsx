import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { userAPI, postAPI } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';
import PostCard from '../../components/Posts/PostCard';
import PostSkeleton from '../../components/Posts/PostSkeleton';
import Avatar from '../../components/common/Avatar';
import { toast } from 'react-toastify';
import { confirmDialog } from '../../utils/confirmDialog';
import {
  FaEdit, FaTimes, FaUserPlus, FaUserCheck, FaUserMinus, FaCamera, FaComments, FaIdCard,
  FaUniversity, FaTint, FaRegImages, FaRegNewspaper, FaExclamationCircle, FaPlay,
} from 'react-icons/fa';
import '../../styles/Profile.css';
import { formatDate } from '../../utils/time';
import { getPostMedia } from '../../utils/media';

const getRelationshipState = (data) => {
  if (data?.relationship_status) {
    return data.relationship_status;
  }

  if (data?.is_following) {
    return 'accepted';
  }

  if (data?.follow_status === 'pending') {
    return 'pending_sent';
  }

  return 'none';
};

const Profile = () => {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [relationshipStatus, setRelationshipStatus] = useState('none');
  const [incomingFollowRequestId, setIncomingFollowRequestId] = useState(null);
  const [followActionLoading, setFollowActionLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [editData, setEditData] = useState({});
  const [profileSaveLoading, setProfileSaveLoading] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersList, setFollowersList] = useState([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [removingFollowerId, setRemovingFollowerId] = useState(null);
  const modalCloseTimerRef = useRef(null);
  const editModeRef = useRef(false);
  editModeRef.current = editMode;
  const isOwnProfile = Boolean(currentUser?.id) && Number(currentUser.id) === Number(userId);

  useEffect(() => {
    loadProfile();
    loadUserPosts();
    loadFollowCounts();
  }, [userId]);

  useEffect(() => {
    return () => {
      if (modalCloseTimerRef.current) {
        clearTimeout(modalCloseTimerRef.current);
      }
    };
  }, []);

  const openEditModal = () => {
    setIsModalClosing(false);
    setEditMode(true);
  };

  const closeEditModal = () => {
    if (!editMode || isModalClosing) return;
    setIsModalClosing(true);
    modalCloseTimerRef.current = setTimeout(() => {
      setEditMode(false);
      setIsModalClosing(false);
    }, 180);
  };

  useEffect(() => {
    const refreshCounts = () => {
      loadFollowCounts();
      loadProfile();
    };

    const intervalId = setInterval(refreshCounts, 10000);
    window.addEventListener('focus', refreshCounts);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', refreshCounts);
    };
  }, [userId]);

  useEffect(() => {
    if (!editMode && !showFollowersModal) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (editMode) closeEditModal();
      else handleCloseFollowersModal();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  const loadProfile = async () => {
    try {
      const response = await userAPI.getProfile(userId);
      const nextRelationshipStatus = getRelationshipState(response.data);

      setProfile(response.data);
      setIsFollowing(Boolean(response.data.is_following));
      setRelationshipStatus(nextRelationshipStatus);
      setIncomingFollowRequestId(response.data.incoming_follow_request_id || null);
      if (!editModeRef.current) {
        setEditData({
          name: response.data.name,
          bio: response.data.bio || '',
          blood_group: response.data.blood_group || '',
          hall_name: response.data.hall_name || '',
          hall_attachement: response.data.hall_attachement || 'Resident',
          department_name: response.data.department_name || '',
        });
      }
    } catch (error) {
      console.error('Error loading profile for user:', userId, error.response?.data || error.message);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const extractCount = (data) => {
    if (typeof data?.Count === 'number') {
      return data.Count;
    }

    if (typeof data?.count === 'number') {
      return data.count;
    }

    const list = data?.value || data?.results || data?.followers || data?.following || data;
    return Array.isArray(list) ? list.length : undefined;
  };

  const loadFollowCounts = async () => {
    try {
      const [followersRes, followingRes] = await Promise.all([
        userAPI.getFollowers(userId),
        userAPI.getFollowing(userId),
      ]);

      const followersCount = extractCount(followersRes.data);
      const followingCount = extractCount(followingRes.data);

      setProfile((prev) => ({
        ...prev,
        followers_count: followersCount ?? prev?.followers_count,
        following_count: followingCount ?? prev?.following_count,
      }));
    } catch (error) {
      console.error('❌ Error loading follow counts:', error);
    }
  };

  const normalizeFollowersList = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.followers)) return data.followers;
    if (Array.isArray(data?.value)) return data.value;
    return [];
  };

  const loadFollowersList = async () => {
    if (!isOwnProfile) return;

    try {
      setFollowersLoading(true);
      const response = await userAPI.getFollowers(userId);
      setFollowersList(normalizeFollowersList(response.data));
    } catch (error) {
      toast.error('Failed to load followers list');
      setFollowersList([]);
    } finally {
      setFollowersLoading(false);
    }
  };

  const handleOpenFollowersModal = async () => {
    if (!isOwnProfile) {
      toast.info('You can manage followers only from your own profile');
      return;
    }

    setShowFollowersModal(true);
    await loadFollowersList();
  };

  const handleCloseFollowersModal = () => {
    if (removingFollowerId) return;
    setShowFollowersModal(false);
  };

  const handleRemoveFollower = async (follower) => {
    const followerId = follower?.user_id;
    if (!followerId || removingFollowerId) return;

    await confirmDialog({
      title: 'Remove Follower',
      message: `Are you sure you want to remove ${follower?.name || 'this follower'}? They will need to follow you again.`,
      confirmText: 'Remove',
      confirmLoadingText: 'Removing...',
      danger: true,
      onConfirmAction: async () => {
        try {
          setRemovingFollowerId(followerId);
          const response = await userAPI.removeFollower(followerId);
          setFollowersList((prev) => prev.filter((f) => Number(f.user_id) !== Number(followerId)));
          setProfile((prev) => ({
            ...prev,
            followers_count: response?.data?.followers_count ?? Math.max(0, (prev?.followers_count || 1) - 1),
          }));
          toast.success(response?.data?.message || 'Follower removed');
        } catch (error) {
          toast.error(error?.response?.data?.error || 'Failed to remove follower');
          throw error;
        } finally {
          setRemovingFollowerId(null);
        }
      },
    });
  };

  const loadUserPosts = async () => {
    try {
      setPostsLoading(true);
      const response = await userAPI.getUserPosts(userId);
      const postsData = response.data.results || response.data;
      const normalizedPosts = postsData.map(post => ({
        ...post,
        user_id: post.user_id || post.author_id,
        user_name: post.user_name || post.author_name,
        profile_picture: post.profile_picture || post.user_picture || post.author_picture
      }));
      setPosts(normalizedPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setPostsLoading(false);
    }
  };

  const refreshRelationshipState = async () => {
    await Promise.all([loadProfile(), loadFollowCounts()]);
  };

  const handleFollow = async () => {
    if (followActionLoading) return;

    try {
      setFollowActionLoading(true);
      const response = await userAPI.followUser(userId);
      const nextRelationshipStatus = getRelationshipState(response?.data);

      setIsFollowing(Boolean(response?.data?.is_following));
      setRelationshipStatus(nextRelationshipStatus);
      setProfile((prev) => ({
        ...prev,
        followers_count: response?.data?.followers_count ?? prev?.followers_count,
        following_count: response?.data?.following_count ?? prev?.following_count,
      }));
      await refreshRelationshipState();
      toast.success(response?.data?.message || 'Follow request sent!');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to update follow status');
    } finally {
      setFollowActionLoading(false);
    }
  };

  const handleAcceptFollowRequest = async () => {
    if (!incomingFollowRequestId || followActionLoading) return;

    try {
      setFollowActionLoading(true);
      const response = await userAPI.acceptFollow(incomingFollowRequestId);
      await refreshRelationshipState();
      toast.success(response?.data?.message || 'Follow request accepted');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to accept follow request');
    } finally {
      setFollowActionLoading(false);
    }
  };

  const handleRejectFollowRequest = async () => {
    if (!incomingFollowRequestId || followActionLoading) return;

    try {
      setFollowActionLoading(true);
      const response = await userAPI.rejectFollow(incomingFollowRequestId);
      await refreshRelationshipState();
      toast.success(response?.data?.message || 'Follow request rejected');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to reject follow request');
    } finally {
      setFollowActionLoading(false);
    }
  };

  const renderFollowAction = () => {
    if (isOwnProfile) {
      return null;
    }

    if (incomingFollowRequestId) {
      return (
        <div className="profile-action-group">
          <button
            className="btn btn-primary"
            onClick={handleAcceptFollowRequest}
            disabled={followActionLoading}
          >
            Accept Request
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleRejectFollowRequest}
            disabled={followActionLoading}
          >
            Reject
          </button>
        </div>
      );
    }

    if (relationshipStatus === 'accepted') {
      return (
        <button
          className="btn btn-secondary"
          onClick={handleFollow}
          disabled={followActionLoading}
        >
          <FaUserCheck /> Unfollow
        </button>
      );
    }

    if (relationshipStatus === 'pending_sent') {
      return (
        <button
          className="btn btn-secondary"
          onClick={handleFollow}
          disabled={followActionLoading}
        >
          <FaUserCheck /> Cancel Request
        </button>
      );
    }

    return (
      <button
        className="btn btn-primary"
        onClick={handleFollow}
        disabled={followActionLoading}
      >
        <FaUserPlus /> Follow
      </button>
    );
  };

  const handleUpdateProfile = async () => {
    if (profileSaveLoading) return;

    const fieldsToCompare = [
      'name',
      'bio',
      'blood_group',
      'hall_name',
      'hall_attachement',
      'department_name',
    ];

    const payload = fieldsToCompare.reduce((acc, key) => {
      const original = (profile?.[key] ?? '').toString();
      const next = (editData?.[key] ?? '').toString();

      if (original !== next) {
        acc[key] = next;
      }

      return acc;
    }, {});

    if (Object.keys(payload).length === 0) {
      closeEditModal();
      toast.info('No profile changes to save');
      return;
    }

    try {
      setProfileSaveLoading(true);
      await userAPI.updateProfile(payload);
      setProfile({ ...profile, ...payload });
      closeEditModal();
      await loadProfile();
      toast.success('Profile updated successfully!');
      window.dispatchEvent(new Event('profile:updated'));
    } catch (error) {
      const message = error?.response?.data?.error || error?.response?.data?.message || 'Failed to update profile';
      toast.error(message);
    } finally {
      setProfileSaveLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('profile_picture', file);

    try {
      const response = await userAPI.uploadProfilePicture(formData);
      setProfile({ ...profile, profile_picture: response.data.profile_picture });
      toast.success('Profile picture updated!');
      window.dispatchEvent(new Event('profile:updated'));
    } catch (error) {
      toast.error('Failed to upload image');
    }
  };

  const mediaTiles = posts.flatMap((post) =>
    getPostMedia(post).map((media, index) => ({
      key: `${post.id || post.post_id}-${index}`,
      postId: post.id || post.post_id,
      ...media,
    })),
  );

  const shell = (children) => (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container">
          <div className="profile-container">{children}</div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="profile-header profile-skeleton" aria-busy="true" aria-label="Loading profile">
        <div className="profile-cover" />
        <div className="profile-info">
          <span className="skel profile-skel-avatar" />
          <div className="profile-details">
            <span className="skel profile-skel-line" style={{ width: '40%', height: 24 }} />
            <span className="skel profile-skel-line" style={{ width: '28%' }} />
            <span className="skel profile-skel-line" style={{ width: '70%' }} />
          </div>
        </div>
      </div>,
    );
  }

  if (!profile) {
    return shell(
      <div className="state-card" role="alert">
        <FaExclamationCircle aria-hidden="true" />
        <strong>We couldn't load this profile</strong>
        <p>It may not exist, or the connection dropped. Try again in a moment.</p>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setLoading(true);
            loadProfile();
          }}
        >
          Try again
        </button>
      </div>,
    );
  }

  const headline = [profile.department_name, profile.batch ? `Batch ${profile.batch}` : null]
    .filter(Boolean)
    .join(' · ');

  return shell(
    <>
      <header className="profile-header">
        <div className="profile-cover" aria-hidden="true" />
        <div className="profile-info">
          <div className="profile-avatar-container">
            <Avatar
              src={profile.profile_picture}
              name={profile.name}
              size={128}
              className="profile-avatar"
            />
            {isOwnProfile && (
              <label className="avatar-upload-btn" title="Change profile photo">
                <FaCamera aria-hidden="true" />
                <span className="sr-only">Change profile photo</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
              </label>
            )}
          </div>

          <div className="profile-details">
            <div className="profile-title-row">
              <div className="profile-title">
                <h1>{profile.name}</h1>
                <p className="profile-headline">{headline || 'BUET community'}</p>
              </div>
              <div className="profile-actions">
                {isOwnProfile ? (
                  <button type="button" className="btn btn-primary" onClick={openEditModal}>
                    <FaEdit aria-hidden="true" /> Edit profile
                  </button>
                ) : (
                  <>
                    {renderFollowAction()}
                    <Link to={`/chat/${userId}`} className="btn btn-secondary">
                      <FaComments aria-hidden="true" /> Message
                    </Link>
                  </>
                )}
              </div>
            </div>

            {profile.bio ? (
              <p className="bio">{profile.bio}</p>
            ) : (
              isOwnProfile && <p className="bio bio-empty">Add a short bio so people know who you are.</p>
            )}

            <ul className="profile-meta">
              {profile.student_id && (
                <li><FaIdCard aria-hidden="true" /> <span>ID {profile.student_id}</span></li>
              )}
              {profile.hall_name && (
                <li><FaUniversity aria-hidden="true" /> <span>{profile.hall_name}</span></li>
              )}
              {profile.blood_group && (
                <li><FaTint aria-hidden="true" /> <span>Blood {profile.blood_group}</span></li>
              )}
            </ul>

            <dl className="profile-stats">
              <div className="stat">
                <dt>Posts</dt>
                <dd>{profile.posts_count || 0}</dd>
              </div>
              <div className="stat">
                {isOwnProfile ? (
                  <button
                    type="button"
                    className="stat-button"
                    onClick={handleOpenFollowersModal}
                    aria-label={`${profile.followers_count || 0} followers. Manage followers`}
                  >
                    <dt>Followers</dt>
                    <dd>{profile.followers_count || 0}</dd>
                  </button>
                ) : (
                  <>
                    <dt>Followers</dt>
                    <dd>{profile.followers_count || 0}</dd>
                  </>
                )}
              </div>
              <div className="stat">
                <dt>Following</dt>
                <dd>{profile.following_count || 0}</dd>
              </div>
              {!isOwnProfile && (
                <div className="stat">
                  <dt>Mutual</dt>
                  <dd>{profile.mutual_friends_count || 0}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </header>

      {isOwnProfile && editMode && (
        <div className={`profile-edit-overlay${isModalClosing ? ' closing' : ''}`} onClick={closeEditModal}>
          <div
            className={`profile-edit-modal${isModalClosing ? ' closing' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-edit-header">
              <h2 id="profile-edit-title">Update profile</h2>
              <button type="button" className="profile-edit-close" onClick={closeEditModal} aria-label="Close edit profile">
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className="profile-edit-form">
              <label className="profile-edit-field">
                <span>Name</span>
                <input
                  type="text"
                  value={editData.name || ''}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  placeholder="Your full name"
                />
              </label>

              <label className="profile-edit-field">
                <span>Bio</span>
                <textarea
                  value={editData.bio || ''}
                  onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                  placeholder="Tell people a bit about yourself"
                  rows="3"
                />
              </label>

              <div className="profile-edit-grid">
                <label className="profile-edit-field">
                  <span>Blood group</span>
                  <select
                    value={editData.blood_group || ''}
                    onChange={(e) => setEditData({ ...editData, blood_group: e.target.value })}
                  >
                    <option value="">Select blood group</option>
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((group) => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </label>

                <label className="profile-edit-field">
                  <span>Hall name</span>
                  <input
                    type="text"
                    value={editData.hall_name || ''}
                    onChange={(e) => setEditData({ ...editData, hall_name: e.target.value })}
                    placeholder="Enter hall name"
                  />
                </label>
              </div>

              <div className="profile-edit-radio-group" role="radiogroup" aria-label="Hall attachment">
                <span>Hall attachment</span>
                {['Resident', 'Attached'].map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name="hall_attachement"
                      value={option}
                      checked={editData.hall_attachement === option}
                      onChange={(e) => setEditData({ ...editData, hall_attachement: e.target.value })}
                    />
                    {option}
                  </label>
                ))}
              </div>

              <label className="profile-edit-field">
                <span>Department</span>
                <input
                  type="text"
                  value={editData.department_name || ''}
                  onChange={(e) => setEditData({ ...editData, department_name: e.target.value })}
                  placeholder="Enter department"
                />
              </label>

              <div className="profile-edit-actions">
                <button type="button" className="btn btn-primary" onClick={handleUpdateProfile} disabled={profileSaveLoading}>
                  {profileSaveLoading ? 'Saving...' : 'Save changes'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeEditModal}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isOwnProfile && showFollowersModal && (
        <div className="followers-modal-overlay" onClick={handleCloseFollowersModal}>
          <div
            className="followers-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="followers-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="followers-modal-header">
              <h2 id="followers-modal-title">Manage followers</h2>
              <button
                type="button"
                className="followers-modal-close"
                onClick={handleCloseFollowersModal}
                disabled={Boolean(removingFollowerId)}
                aria-label="Close followers"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>
            <div className="followers-modal-body">
              {followersLoading ? (
                <p className="followers-note">Loading followers...</p>
              ) : followersList.length === 0 ? (
                <p className="followers-note">No followers yet.</p>
              ) : (
                followersList.map((follower) => (
                  <div className="follower-row" key={follower.user_id}>
                    <div className="follower-info">
                      <Avatar src={follower.profile_picture} name={follower.name} size={44} className="follower-avatar" decorative />
                      <div className="follower-meta">
                        <strong>{follower.name || 'Unknown'}</strong>
                        <span>
                          {follower.department_name || 'Unknown dept'}
                          {follower.batch ? ` · Batch ${follower.batch}` : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary follower-remove-btn"
                      onClick={() => handleRemoveFollower(follower)}
                      disabled={removingFollowerId === follower.user_id}
                    >
                      <FaUserMinus aria-hidden="true" /> {removingFollowerId === follower.user_id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="profile-tabs" role="tablist" aria-label="Profile sections">
        {[
          ['posts', 'Posts'],
          ['media', 'Media'],
          ['about', 'About'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`profile-tab-${id}`}
            aria-selected={activeTab === id}
            aria-controls="profile-panel"
            className={`tab ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="profile-content" id="profile-panel" role="tabpanel" aria-labelledby={`profile-tab-${activeTab}`}>
        {activeTab === 'posts' && (
          <div className="posts-section">
            {postsLoading ? (
              <>
                <PostSkeleton />
                <PostSkeleton />
              </>
            ) : posts.length === 0 ? (
              <div className="state-card">
                <FaRegNewspaper aria-hidden="true" />
                <strong>{isOwnProfile ? "You haven't posted yet" : 'No posts yet'}</strong>
                <p>
                  {isOwnProfile
                    ? 'Share what you are working on with the BUET community.'
                    : `${profile.name} hasn't shared anything yet.`}
                </p>
                {isOwnProfile && (
                  <Link to="/" className="btn btn-secondary btn-sm">Write a post</Link>
                )}
              </div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={(postId) => setPosts((prev) => prev.filter((item) => item.id !== postId))}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'media' && (
          mediaTiles.length === 0 ? (
            <div className="state-card">
              <FaRegImages aria-hidden="true" />
              <strong>No photos or videos yet</strong>
              <p>Media from posts will show up here.</p>
            </div>
          ) : (
            <ul className="media-grid-tiles">
              {mediaTiles.map((tile) => (
                <li key={tile.key}>
                  <Link to={`/posts/${tile.postId}`} className="media-tile" aria-label="Open post">
                    {tile.type === 'video' ? (
                      <>
                        <video src={tile.url} muted preload="metadata" />
                        <span className="media-tile-badge"><FaPlay aria-hidden="true" /></span>
                      </>
                    ) : (
                      <img src={tile.url} alt="" loading="lazy" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )
        )}

        {activeTab === 'about' && (
          <div className="about-section">
            <div className="about-card">
              <h2>About</h2>
              <dl className="about-list">
                {[
                  ['Student ID', profile.student_id],
                  ['Email', profile.email],
                  ['Department', profile.department_name],
                  ['Batch', profile.batch],
                  ['Hall', profile.hall_name],
                  ['Hall attachment', profile.hall_attachement],
                  ['Blood group', profile.blood_group],
                  ['Bio', profile.bio],
                  ['Member since', profile.created_at ? formatDate(profile.created_at) : null],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div className="about-item" key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </div>
        )}
      </div>
    </>,
  );
};

export default Profile;
