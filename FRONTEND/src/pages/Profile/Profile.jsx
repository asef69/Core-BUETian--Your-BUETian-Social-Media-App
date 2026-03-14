import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { userAPI, postAPI } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';
import PostCard from '../../components/Posts/PostCard';
import { toast } from 'react-toastify';
import { FaEdit, FaUserPlus, FaUserCheck } from 'react-icons/fa';
import '../../styles/Profile.css';

const Profile = () => {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    loadProfile();
    loadUserPosts();
    loadFollowCounts();
  }, [userId]);

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
      setProfile(response.data);
      setIsOwnProfile(Boolean(currentUser?.id) && currentUser.id === parseInt(userId));
      setIsFollowing(Boolean(response.data.is_following));
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

  const handleFollow = async () => {
    if (isFollowing) return;

    try {
      const response = await userAPI.followUser(userId);
      const accepted = Boolean(response?.data?.is_following || response?.data?.status === 'accepted');

      setIsFollowing(accepted);
      setProfile((prev) => ({
        ...prev,
        followers_count: response?.data?.followers_count ?? prev?.followers_count,
      }));
      await loadFollowCounts();
      toast.success(response?.data?.message || 'Follow request sent!');
    } catch (error) {
      toast.error('Failed to follow user');
    }
  };

  const handleUpdateProfile = async () => {
    try {
      await userAPI.updateProfile(editData);
      setProfile({ ...profile, ...editData });
      setEditMode(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile');
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
                  {editMode ? (
                    <div className="edit-profile">
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        placeholder="Name"
                      />
                      <textarea
                        value={editData.bio}
                        onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                        placeholder="Bio"
                        rows="3"
                      />
                      <select
                        value={editData.blood_group}
                        onChange={(e) => setEditData({ ...editData, blood_group: e.target.value })}
                      >
                        <option value="">Select Blood Group</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                      <input
                        type="text"
                        value={editData.hall_name}
                        onChange={(e) => setEditData({ ...editData, hall_name: e.target.value })}
                        placeholder="Hall Name"
                      />
                      <div className="radio-group">
                        <label>
                          Hall Attachment:
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
                      <input
                        type="text"
                        value={editData.department_name}
                        onChange={(e) => setEditData({ ...editData, department_name: e.target.value })}
                        placeholder="Department"
                      />
                      <div className="edit-actions">
                        <button className="btn btn-primary" onClick={handleUpdateProfile}>
                          Save
                        </button>
                        <button className="btn btn-secondary" onClick={() => setEditMode(false)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
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
                        <button className="btn btn-primary" onClick={() => setEditMode(true)}>
                          <FaEdit /> Edit Profile
                        </button>
                      ) : (
                        <button
                          className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={handleFollow}
                          disabled={isFollowing}
                        >
                          {isFollowing ? <><FaUserCheck /> Following</> : <><FaUserPlus /> Follow</>}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

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
