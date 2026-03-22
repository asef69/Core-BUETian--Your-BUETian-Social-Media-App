import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { groupAPI, postAPI, userAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import PostCard from '../../components/Posts/PostCard';
import { toast } from 'react-toastify';
import { FaUsers, FaSignOutAlt, FaImage, FaVideo, FaTimes, FaTrash } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';

const GroupDetail = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [invitedMembers, setInvitedMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostFiles, setNewPostFiles] = useState([]);
  const [creatingPost, setCreatingPost] = useState(false);
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [updatingCover, setUpdatingCover] = useState(false);
  const [followersToInvite, setFollowersToInvite] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCandidates, setSearchCandidates] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [followersPage, setFollowersPage] = useState(1);
  const [followersPageSize] = useState(5);
  const [searchPage, setSearchPage] = useState(1);
  const [searchPageSize] = useState(5);
  const [activity, setActivity] = useState({});

  useEffect(() => {
    loadGroupData();
  }, [groupId]);

  const MEDIA_BASE_URL = 'http://localhost:8000';

  const toAbsoluteUrl = (url) => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('//')) return `${window.location.protocol}${url}`;
    const normalized = url.startsWith('/') ? url : `/${url}`;
    return `${MEDIA_BASE_URL}${normalized}`;
  };

  const setFallbackOnce = (event, fallbackSrc) => {
    if (event.currentTarget.dataset.fallbackApplied) return;
    event.currentTarget.dataset.fallbackApplied = 'true';
    event.currentTarget.src = fallbackSrc;
  };

  const extractItems = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.value)) return data.value;
    if (Array.isArray(data?.posts)) return data.posts;
    if (Array.isArray(data?.members)) return data.members;
    return [];
  };

  const extractGroup = (data) => {
    if (!data) return null;
    if (Array.isArray(data?.value) && data.value.length > 0) return data.value[0];
    if (data.group) return data.group;
    return data;
  };

  const normalizePost = (post) => {
    const userFromObject = post.user || post.author || {};
    return {
      ...post,
      user_id: post.user_id || post.author_id || userFromObject.id,
      user_name: post.user_name || post.author_name || userFromObject.name,
      profile_picture:
        post.profile_picture ||
        post.user_picture ||
        post.author_picture ||
        userFromObject.profile_picture,
    };
  };

  const normalizeMember = (member) => ({
    ...member,
    user_id: member.user_id || member.id || member.member_id,
    name: member.name || member.user_name || member.full_name,
    profile_picture:
      member.profile_picture || member.user_picture || member.avatar || member.image,
    role: member.role || member.member_role || member.group_role || 'member',
  });

  const normalizeUser = (item) => ({
    user_id: item.user_id || item.id,
    name: item.name || item.user_name || 'User',
    profile_picture: item.profile_picture || item.user_picture || item.avatar,
  });

  const getCurrentUserRole = (groupData, memberList) => {
    const roleFromGroup =
      groupData?.current_user_role || groupData?.role || groupData?.user_role;
    if (roleFromGroup) {
      return String(roleFromGroup).toLowerCase();
    }

    if (groupData?.is_admin === true || groupData?.current_user_is_admin === true) {
      return 'admin';
    }
    if (groupData?.is_moderator === true || groupData?.current_user_is_moderator === true) {
      return 'moderator';
    }

    const currentUserId = currentUser?.id;
    if (!currentUserId) return 'member';

    const adminCandidates = [
      groupData?.admin_id,
      groupData?.owner_id,
      groupData?.created_by,
      groupData?.created_by?.id,
      groupData?.admin?.id,
      groupData?.owner?.id,
    ].filter(Boolean);

    if (adminCandidates.includes(currentUserId)) return 'admin';

    const moderatorCandidates =
      groupData?.moderators || groupData?.moderator_ids || groupData?.mods;
    if (Array.isArray(moderatorCandidates) && moderatorCandidates.includes(currentUserId)) {
      return 'moderator';
    }

    const memberMatch = memberList.find((member) => member.user_id === currentUserId);
    return String(memberMatch?.role || 'member').toLowerCase();
  };

  const loadGroupData = async () => {
    try {
      const [groupRes, postsRes, membersRes, pendingRes, invitedRes, activityRes] = await Promise.all([
        groupAPI.getGroup(groupId),
        groupAPI.getGroupPosts(groupId),
        groupAPI.getMembers(groupId),
        groupAPI.getPending(groupId).catch(() => ({ data: [] })),
        groupAPI.getInvited(groupId).catch(() => ({ data: [] })),
        groupAPI.getActivity(groupId).catch(() => ({ data: {} })),
      ]);
      const groupData = extractGroup(groupRes.data);
      const postsData = extractItems(postsRes.data).map(normalizePost);
      const membersData = extractItems(membersRes.data).map(normalizeMember);
      const pendingData = extractItems(pendingRes.data).map(normalizeMember);
      const invitedData = extractItems(invitedRes.data).map(normalizeMember);

      setGroup(groupData);
      setPosts(postsData);
      setMembers(membersData);
      setPendingMembers(pendingData);
      setInvitedMembers(invitedData);
      setActivity(activityRes?.data || {});
      setCoverImageFile(null);
      setFollowersPage(1);
      setSearchPage(1);

      if (currentUser?.id) {
        try {
          const followersRes = await userAPI.getFollowers(currentUser.id);
          const followerItems = extractItems(followersRes.data).map(normalizeUser);
          const memberIds = new Set(membersData.map((member) => member.user_id));
          const pendingIds = new Set(pendingData.map((member) => member.user_id));
          const invitedIds = new Set(invitedData.map((member) => member.user_id));
          const filteredFollowers = followerItems.filter(
            (item) =>
              !memberIds.has(item.user_id) &&
              !pendingIds.has(item.user_id) &&
              !invitedIds.has(item.user_id)
          );
          setFollowersToInvite(filteredFollowers);
        } catch (error) {
          setFollowersToInvite([]);
        }
      }
    } catch (error) {
      toast.error('Failed to load group');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();

    const trimmedContent = newPostContent.trim();
    if (!trimmedContent && newPostFiles.length === 0) {
      toast.error('Write something or attach media to post');
      return;
    }

    try {
      setCreatingPost(true);

      const uploadedUrls = [];

      for (const file of newPostFiles) {
        const isVideo = file.type.startsWith('video/');
        const formData = new FormData();
        formData.append('media', file);
        formData.append('media_type', isVideo ? 'video' : 'image');

        const uploadRes = await postAPI.uploadMedia(formData);
        const urls = (uploadRes?.data?.uploaded_files || []).map((item) => item.url).filter(Boolean);
        uploadedUrls.push(...urls);
      }

      await groupAPI.createGroupPost(groupId, {
        content: trimmedContent,
        media_urls: uploadedUrls,
      });

      setNewPostContent('');
      setNewPostFiles([]);
      loadGroupData();
      toast.success('Post created!');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to create post');
    } finally {
      setCreatingPost(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;

    try {
      await groupAPI.leaveGroup(groupId);
      toast.success('Left group successfully');
      navigate('/groups');
    } catch (error) {
      toast.error('Failed to leave group');
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('Delete this group permanently? This cannot be undone.')) return;

    try {
      await groupAPI.deleteGroup(groupId);
      toast.success('Group deleted successfully');
      navigate('/groups');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to delete group');
    }
  };

  const handleAcceptMember = async (userId) => {
    try {
      await groupAPI.acceptMember(groupId, userId);
      toast.success('Member accepted');
      loadGroupData();
    } catch (error) {
      toast.error('Failed to accept member');
    }
  };

  const handleRejectMember = async (userId) => {
    try {
      await groupAPI.rejectMember(groupId, userId);
      toast.success('Member request rejected');
      loadGroupData();
    } catch (error) {
      toast.error('Failed to reject member');
    }
  };

  const handlePromote = async (userId) => {
    try {
      await groupAPI.promoteMember(groupId, userId);
      toast.success('Member promoted');
      loadGroupData();
    } catch (error) {
      toast.error('Failed to promote member');
    }
  };

  const handleDemote = async (userId) => {
    try {
      await groupAPI.demoteMember(groupId, userId);
      toast.success('Moderator demoted');
      loadGroupData();
    } catch (error) {
      toast.error('Failed to demote member');
    }
  };

  const handleTransferAdmin = async (userId) => {
    if (!window.confirm('Transfer admin rights to this member?')) return;

    try {
      await groupAPI.transferAdmin(groupId, { new_admin_id: userId });
      toast.success('Admin rights transferred');
      loadGroupData();
    } catch (error) {
      toast.error('Failed to transfer admin');
    }
  };

  const handleInviteMember = async (userId) => {
    try {
      const response = await groupAPI.inviteMember(groupId, userId);
      toast.success(response?.data?.message || 'User invited successfully');
      loadGroupData();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to invite user');
    }
  };

  const handleCancelInvite = async (userId) => {
    try {
      const response = await groupAPI.cancelInvite(groupId, userId);
      toast.success(response?.data?.message || 'Invite canceled');
      loadGroupData();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to cancel invite');
    }
  };

  const handleKickMember = async (userId) => {
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      const response = await groupAPI.removeMember(groupId, userId);
      toast.success(response?.data?.message || 'Member removed successfully');
      loadGroupData();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleSearchUsers = async () => {
    if (!searchTerm.trim()) {
      setSearchCandidates([]);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await userAPI.searchUsers(searchTerm.trim());
      const users = extractItems(response.data).map(normalizeUser);
      const memberIds = new Set(members.map((member) => member.user_id));
      const pendingIds = new Set(pendingMembers.map((member) => member.user_id));
      const invitedIds = new Set(invitedMembers.map((member) => member.user_id));
      setSearchCandidates(
        users.filter(
          (item) =>
            !memberIds.has(item.user_id) &&
            !pendingIds.has(item.user_id) &&
            !invitedIds.has(item.user_id)
        )
      );
      setSearchPage(1);
    } catch (error) {
      toast.error('Failed to search users');
    } finally {
      setSearchLoading(false);
    }
  };

  const pagedFollowers = followersToInvite.slice(
    (followersPage - 1) * followersPageSize,
    followersPage * followersPageSize
  );
  const followersTotalPages = Math.max(1, Math.ceil(followersToInvite.length / followersPageSize));

  const pagedSearchCandidates = searchCandidates.slice(
    (searchPage - 1) * searchPageSize,
    searchPage * searchPageSize
  );
  const searchTotalPages = Math.max(1, Math.ceil(searchCandidates.length / searchPageSize));

  const handleUpdateCover = async (e) => {
    e.preventDefault();
    if (!coverImageFile) return;

    setUpdatingCover(true);
    try {
      const formData = new FormData();
      formData.append('cover_image', coverImageFile);
      await groupAPI.updateGroup(groupId, formData);
      toast.success('Cover image updated');
      loadGroupData();
    } catch (error) {
      toast.error('Failed to update cover image');
    } finally {
      setUpdatingCover(false);
    }
  };

  if (loading) {
    return (
      <div className="app-layout">
        <Navbar />
        <div className="loading">Loading group...</div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="app-layout">
        <Navbar />
        <div className="error">Group not found</div>
      </div>
    );
  }

  const currentUserRole = getCurrentUserRole(group, members);
  const canManageMembers =
    currentUserRole === 'admin' ||
    currentUserRole === 'owner' ||
    currentUserRole === 'moderator';
  const canChangeRoles = currentUserRole === 'admin' || currentUserRole === 'owner';

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container">
          <div className="group-detail">
            <div className="group-header">
              <div className="group-cover-wrapper">
                <img
                  src={toAbsoluteUrl(group.cover_image) || '/default-group.png'}
                  alt={group.name}
                  className="group-cover-large"
                  onError={(e) => setFallbackOnce(e, '/default-group.png')}
                />
                <div className="group-cover-overlay" aria-hidden="true" />
              </div>
              <div className="group-info">
                <h1>{group.name}</h1>
                <p>{group.description}</p>
                <div className="group-meta">
                  <span><FaUsers /> {members.length} members</span>
                </div>
                {canChangeRoles && (
                  <form className="group-cover-form" onSubmit={handleUpdateCover}>
                    <input
                      id="group-cover-input"
                      className="group-cover-input-hidden"
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => setCoverImageFile(e.target.files?.[0] || null)}
                    />
                    <button
                      className="btn btn-secondary cover-picker-btn"
                      type="button"
                      onClick={() => document.getElementById('group-cover-input')?.click()}
                    >
                      {coverImageFile ? 'Change Cover' : 'Choose Cover'}
                    </button>
                    <span className="cover-file-name">{coverImageFile?.name || 'No file selected'}</span>
                    <button
                      className="btn btn-secondary"
                      type="submit"
                      disabled={updatingCover || !coverImageFile}
                    >
                      {updatingCover ? 'Updating...' : 'Update Cover'}
                    </button>
                  </form>
                )}
                <div className="group-primary-actions">
                  <button className="btn btn-danger" onClick={handleLeaveGroup}>
                    <FaSignOutAlt /> Leave Group
                  </button>
                  {canChangeRoles && (
                    <button className="btn btn-danger delete-group-btn" onClick={handleDeleteGroup}>
                      <FaTrash /> Delete Group
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="group-tabs">
              <button
                className={`tab ${activeTab === 'posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('posts')}
              >
                Posts
              </button>
              <button
                className={`tab ${activeTab === 'members' ? 'active' : ''}`}
                onClick={() => setActiveTab('members')}
              >
                Members ({members.length})
              </button>
              {canManageMembers && (
                <button
                  className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setActiveTab('dashboard')}
                >
                  Admin Dashboard
                </button>
              )}
            </div>

            {activeTab === 'posts' && (
              <div className="group-posts">
                <form onSubmit={handleCreatePost} className="create-post-form fancy-post-form">
                  <textarea
                    placeholder="What's on your mind?"
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    rows="4"
                  />

                  <input
                    id="group-post-photo-input"
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      const selected = Array.from(e.target.files || []);
                      if (selected.length > 0) {
                        setNewPostFiles((prev) => [...prev, ...selected]);
                      }
                      e.target.value = '';
                    }}
                  />
                  <input
                    id="group-post-video-input"
                    type="file"
                    accept="video/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      const selected = Array.from(e.target.files || []);
                      if (selected.length > 0) {
                        setNewPostFiles((prev) => [...prev, ...selected]);
                      }
                      e.target.value = '';
                    }}
                  />

                  <div className="fancy-post-actions">
                    <button
                      type="button"
                      className="fancy-media-btn"
                      onClick={() => document.getElementById('group-post-photo-input')?.click()}
                    >
                      <FaImage /> Photo
                    </button>
                    <button
                      type="button"
                      className="fancy-media-btn"
                      onClick={() => document.getElementById('group-post-video-input')?.click()}
                    >
                      <FaVideo /> Video
                    </button>

                    <button type="submit" className="btn btn-primary fancy-post-submit" disabled={creatingPost}>
                      {creatingPost ? 'Posting...' : 'Post'}
                    </button>
                  </div>

                  {newPostFiles.length > 0 && (
                    <div className="selected-media-list">
                      {newPostFiles.map((file, index) => (
                        <span key={`${file.name}-${file.lastModified}`} className="selected-media-chip">
                          {file.name}
                          <button
                            type="button"
                            className="remove-media-chip"
                            onClick={() => {
                              setNewPostFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
                            }}
                            aria-label={`Remove ${file.name}`}
                          >
                            <FaTimes />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </form>

                {posts.length === 0 ? (
                  <p>No posts yet</p>
                ) : (
                  posts.map((post) => <PostCard key={post.id} post={post} />)
                )}
              </div>
            )}

            {activeTab === 'members' && (
              <div className="group-members">
                {canManageMembers && pendingMembers.length > 0 && (
                  <div className="pending-members">
                    <h3>Pending Requests</h3>
                    {pendingMembers.map((member) => (
                      <div key={member.user_id} className="member-item pending">
                        <img
                          src={toAbsoluteUrl(member.profile_picture) || '/default-avatar.png'}
                          alt={member.name || 'User'}
                          className="avatar"
                          onError={(e) => setFallbackOnce(e, '/default-avatar.png')}
                        />
                        <div className="member-info">
                          <h4>{member.name}</h4>
                          <span className="member-role">pending</span>
                        </div>
                        <div className="member-actions">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAcceptMember(member.user_id)}
                          >
                            Accept
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleRejectMember(member.user_id)}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {canManageMembers && (
                  <div className="pending-members">
                    <h3>Invited Users</h3>
                    {invitedMembers.length === 0 ? (
                      <p>No active invites right now.</p>
                    ) : (
                      invitedMembers.map((member) => (
                        <div key={member.user_id} className="member-item pending">
                          <img
                            src={toAbsoluteUrl(member.profile_picture) || '/default-avatar.png'}
                            alt={member.name || 'User'}
                            className="avatar"
                            onError={(e) => setFallbackOnce(e, '/default-avatar.png')}
                          />
                          <div className="member-info">
                            <h4>{member.name}</h4>
                            <span className="member-role">invited</span>
                          </div>
                          <div className="member-actions">
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleCancelInvite(member.user_id)}
                            >
                              Cancel Invite
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {canManageMembers && (
                  <div className="pending-members">
                    <h3>Invite Followers</h3>
                    {followersToInvite.length === 0 ? (
                      <p>No followers available to invite.</p>
                    ) : (
                      pagedFollowers.map((person) => (
                        <div key={person.user_id} className="member-item pending">
                          <img
                            src={toAbsoluteUrl(person.profile_picture) || '/default-avatar.png'}
                            alt={person.name || 'User'}
                            className="avatar"
                            onError={(e) => setFallbackOnce(e, '/default-avatar.png')}
                          />
                          <div className="member-info">
                            <h4>{person.name}</h4>
                            <span className="member-role">follower</span>
                          </div>
                          <div className="member-actions">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleInviteMember(person.user_id)}
                            >
                              Invite
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                    {followersToInvite.length > followersPageSize && (
                      <div className="member-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setFollowersPage((page) => Math.max(1, page - 1))}
                          disabled={followersPage === 1}
                        >
                          Prev
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setFollowersPage((page) => Math.min(followersTotalPages, page + 1))}
                          disabled={followersPage >= followersTotalPages}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {canManageMembers && (
                  <div className="pending-members">
                    <h3>Invite Random Users</h3>
                    <div className="create-post-form">
                      <textarea
                        placeholder="Search users by name, id, or email"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        rows="2"
                      />
                      <button type="button" className="btn btn-primary" onClick={handleSearchUsers}>
                        {searchLoading ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                    {pagedSearchCandidates.map((person) => (
                      <div key={person.user_id} className="member-item pending">
                        <img
                          src={toAbsoluteUrl(person.profile_picture) || '/default-avatar.png'}
                          alt={person.name || 'User'}
                          className="avatar"
                          onError={(e) => setFallbackOnce(e, '/default-avatar.png')}
                        />
                        <div className="member-info">
                          <h4>{person.name}</h4>
                          <span className="member-role">search result</span>
                        </div>
                        <div className="member-actions">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleInviteMember(person.user_id)}
                          >
                            Invite
                          </button>
                        </div>
                      </div>
                    ))}
                    {searchCandidates.length > searchPageSize && (
                      <div className="member-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSearchPage((page) => Math.max(1, page - 1))}
                          disabled={searchPage === 1}
                        >
                          Prev
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSearchPage((page) => Math.min(searchTotalPages, page + 1))}
                          disabled={searchPage >= searchTotalPages}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {members.map((member) => (
                  <div key={member.user_id} className="member-item">
                    <img
                      src={toAbsoluteUrl(member.profile_picture) || '/default-avatar.png'}
                      alt={member.name || 'User'}
                      className="avatar"
                      onError={(e) => setFallbackOnce(e, '/default-avatar.png')}
                    />
                    <div className="member-info">
                      <h4>{member.name}</h4>
                      <span className="member-role">{member.role}</span>
                    </div>
                    {member.user_id !== currentUser?.id && (
                      <div className="member-actions">
                        {canChangeRoles && (
                          <>
                            {member.role === 'moderator' ? (
                              <>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleDemote(member.user_id)}
                                >
                                  Demote
                                </button>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleTransferAdmin(member.user_id)}
                                >
                                  Make Admin
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handlePromote(member.user_id)}
                                >
                                  Promote
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleTransferAdmin(member.user_id)}
                                >
                                  Make Admin
                                </button>
                              </>
                            )}
                          </>
                        )}

                        {canManageMembers &&
                          !(
                            currentUserRole === 'moderator' &&
                            (member.role === 'admin' || member.role === 'owner')
                          ) && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleKickMember(member.user_id)}
                          >
                            Kick
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'dashboard' && canManageMembers && (
              <div className="group-admin-dashboard">
                <div className="dashboard-panel">
                  <div className="dashboard-heading">
                    <h3>30-Day Group Activity</h3>
                    <p>Track how your group is growing and engaging this month.</p>
                  </div>

                  <div className="dashboard-stats-grid">
                    <div className="dashboard-stat-card">
                      <span className="stat-label">Posts</span>
                      <strong>{activity.posts_count || 0}</strong>
                    </div>
                    <div className="dashboard-stat-card">
                      <span className="stat-label">Active Members</span>
                      <strong>{activity.active_members_count || 0}</strong>
                    </div>
                    <div className="dashboard-stat-card">
                      <span className="stat-label">New Members</span>
                      <strong>{activity.new_members_count || 0}</strong>
                    </div>
                    <div className="dashboard-stat-card">
                      <span className="stat-label">Likes</span>
                      <strong>{activity.total_likes || 0}</strong>
                    </div>
                    <div className="dashboard-stat-card">
                      <span className="stat-label">Comments</span>
                      <strong>{activity.total_comments || 0}</strong>
                    </div>
                  </div>
                </div>

                <div className="dashboard-panel queue-panel">
                  <div className="dashboard-heading">
                    <h3>Member Queue</h3>
                    <p>Quickly monitor approvals and total group size.</p>
                  </div>

                  <div className="queue-metrics">
                    <div className="queue-item">
                      <span className="queue-label">Pending Requests</span>
                      <strong>{pendingMembers.length}</strong>
                    </div>
                    <div className="queue-item">
                      <span className="queue-label">Total Members</span>
                      <strong>{members.length}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupDetail;
