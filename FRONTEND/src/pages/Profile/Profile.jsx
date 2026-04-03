import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { userAPI, postAPI } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';
import PostCard from '../../components/Posts/PostCard';
import { toast } from 'react-toastify';
import { confirmDialog } from '../../utils/confirmDialog';
import { FaEdit, FaTimes, FaUserPlus, FaUserCheck, FaUserMinus } from 'react-icons/fa';
import '../../styles/Profile.css';

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

  const loadProfile = async () => {
    try {
      const response = await userAPI.getProfile(userId);
      const nextRelationshipStatus = getRelationshipState(response.data);

      setProfile(response.data);
      setIsFollowing(Boolean(response.data.is_following));
      setRelationshipStatus(nextRelationshipStatus);
      setIncomingFollowRequestId(response.data.incoming_follow_request_id || null);
      setEditData({
        name: response.data.name,
        bio: response.data.bio || '',
        blood_group: response.data.blood_group || '',
        hall_name: response.data.hall_name || '',
        hall_attachement: response.data.hall_attachement || 'Resident',
        department_name: response.data.department_name || '',
      });
      console.log('✅ Profile loaded successfully for user:', userId, response.data);
    } catch (error) {
      console.error('❌ Error loading profile for user:', userId, {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        data: error.response?.data
      });
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
    } catch (error) {
      toast.error('Failed to upload image');
    }
  };

  if (loading) {
    return (
      <div className="app-layout">
        <Navbar />
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="app-layout">
        <Navbar />
        <div className="error">Profile not found</div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container">
          <div className="profile-container">
            <div className="profile-header">
              <div className="profile-cover"></div>
              <div className="profile-info">
                <div className="profile-avatar-container">
                  <img
                    src={profile.profile_picture || '/default-avatar.png'}
                    alt={profile.name}
                    className="profile-avatar"
                  />
                  {isOwnProfile && (
                    <label className="avatar-upload-btn">
                      <FaEdit />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                </div>

                <div className="profile-details">
                  <>
                    <h1>{profile.name}</h1>
                    <p className="bio">{profile.bio || 'No bio yet'}</p>
                    <div className="profile-meta">
                      <span>Student ID: {profile.student_id}</span>
                      <span>{profile.department_name}</span>
                      <span>Batch {profile.batch}</span>
                      {profile.blood_group && <span>Blood: {profile.blood_group}</span>}
                    </div>

                    <div className="profile-stats">
                      <div className="stat">
                        <strong>{profile.posts_count || 0}</strong>
                        <span>Posts</span>
                      </div>
                      <div className="stat">
                        <strong>{profile.followers_count || 0}</strong>
                        <span>Followers</span>
                        {isOwnProfile && (
                          <button
                            type="button"
                            className="followers-manage-btn"
                            onClick={handleOpenFollowersModal}
                          >
                            Manage
                          </button>
                        )}
                      </div>
                      <div className="stat">
                        <strong>{profile.following_count || 0}</strong>
                        <span>Following</span>
                      </div>
                      {!isOwnProfile && (
                        <div className="stat">
                          <strong>{profile.mutual_friends_count || 0}</strong>
                          <span>Mutual Friends</span>
                        </div>
                      )}
                    </div>

                    {isOwnProfile ? (
                      <button className="btn btn-primary" onClick={openEditModal}>
                        <FaEdit /> Edit Profile
                      </button>
                    ) : (
                      renderFollowAction()
                    )}
                  </>
                </div>
              </div>
            </div>

            {isOwnProfile && editMode && (
              <div
                className={`profile-edit-overlay${isModalClosing ? ' closing' : ''}`}
                onClick={closeEditModal}
              >
                <div
                  className={`profile-edit-modal${isModalClosing ? ' closing' : ''}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="profile-edit-header">
                    <h2>Update Profile</h2>
                    <button
                      className="profile-edit-close"
                      onClick={closeEditModal}
                      aria-label="Close edit profile modal"
                    >
                      x
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
                        <span>Blood Group</span>
                        <select
                          value={editData.blood_group || ''}
                          onChange={(e) => setEditData({ ...editData, blood_group: e.target.value })}
                        >
                          <option value="">Select blood group</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                        </select>
                      </label>

                      <label className="profile-edit-field">
                        <span>Hall Name</span>
                        <input
                          type="text"
                          value={editData.hall_name || ''}
                          onChange={(e) => setEditData({ ...editData, hall_name: e.target.value })}
                          placeholder="Enter hall name"
                        />
                      </label>
                    </div>

                    <div className="profile-edit-radio-group">
                      <span>Hall Attachment</span>
                      <label>
                        <input
                          type="radio"
                          name="hall_attachement"
                          value="Resident"
                          checked={editData.hall_attachement === 'Resident'}
                          onChange={(e) => setEditData({ ...editData, hall_attachement: e.target.value })}
                        />
                        Resident
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="hall_attachement"
                          value="Attached"
                          checked={editData.hall_attachement === 'Attached'}
                          onChange={(e) => setEditData({ ...editData, hall_attachement: e.target.value })}
                        />
                        Attached
                      </label>
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
                      <button className="btn btn-primary" onClick={handleUpdateProfile} disabled={profileSaveLoading}>
                        {profileSaveLoading ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button className="btn btn-secondary" onClick={closeEditModal}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isOwnProfile && showFollowersModal && (
              <div className="followers-modal-overlay" onClick={handleCloseFollowersModal}>
                <div className="followers-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="followers-modal-header">
                    <h2>Manage Followers</h2>
                    <button
                      type="button"
                      className="followers-modal-close"
                      onClick={handleCloseFollowersModal}
                      disabled={Boolean(removingFollowerId)}
                      aria-label="Close followers modal"
                    >
                      <FaTimes />
                    </button>
                  </div>
                  <div className="followers-modal-body">
                    {followersLoading ? (
                      <p>Loading followers...</p>
                    ) : followersList.length === 0 ? (
                      <p>No followers yet.</p>
                    ) : (
                      followersList.map((follower) => (
                        <div className="follower-row" key={follower.user_id}>
                          <div className="follower-info">
                            <img
                              src={follower.profile_picture || '/default-avatar.png'}
                              alt={follower.name || 'Follower'}
                              className="follower-avatar"
                            />
                            <div className="follower-meta">
                              <strong>{follower.name || 'Unknown'}</strong>
                              <span>
                                {follower.department_name || 'Unknown dept'}
                                {follower.batch ? ` • Batch ${follower.batch}` : ''}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary follower-remove-btn"
                            onClick={() => handleRemoveFollower(follower)}
                            disabled={removingFollowerId === follower.user_id}
                          >
                            <FaUserMinus /> {removingFollowerId === follower.user_id ? 'Removing...' : 'Remove'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="profile-tabs">
              <button
                className={`tab ${activeTab === 'posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('posts')}
              >
                Posts
              </button>
              <button
                className={`tab ${activeTab === 'about' ? 'active' : ''}`}
                onClick={() => setActiveTab('about')}
              >
                About
              </button>
            </div>

            <div className="profile-content">
              {activeTab === 'posts' && (
                <div className="posts-section">
                  {posts.length === 0 ? (
                    <p>No posts yet</p>
                  ) : (
                    posts.map((post) => <PostCard key={post.id} post={post} />)
                  )}
                </div>
              )}

              {activeTab === 'about' && (
                <div className="about-section">
                  <div className="about-card">
                    <h3>About</h3>
                    <div className="about-item">
                      <strong>Student ID:</strong>
                      <span>{profile.student_id}</span>
                    </div>
                    <div className="about-item">
                      <strong>Email:</strong>
                      <span>{profile.email}</span>
                    </div>
                    <div className="about-item">
                      <strong>Department:</strong>
                      <span>{profile.department_name}</span>
                    </div>
                    <div className="about-item">
                      <strong>Batch:</strong>
                      <span>{profile.batch}</span>
                    </div>
                    {profile.hall_name && (
                      <div className="about-item">
                        <strong>Hall:</strong>
                        <span>{profile.hall_name}</span>
                      </div>
                    )}
                    {profile.hall_attachement && (
                      <div className="about-item">
                        <strong>Hall Attachment:</strong>
                        <span>{profile.hall_attachement}</span>
                      </div>
                    )}
                    {profile.blood_group && (
                      <div className="about-item">
                        <strong>Blood Group:</strong>
                        <span>{profile.blood_group}</span>
                      </div>
                    )}
                    {profile.bio && (
                      <div className="about-item">
                        <strong>Bio:</strong>
                        <span>{profile.bio}</span>
                      </div>
                    )}
                    {profile.created_at && (
                      <div className="about-item">
                        <strong>Member Since:</strong>
                        <span>{new Date(profile.created_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
