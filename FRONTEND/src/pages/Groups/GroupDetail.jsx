import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { groupAPI, postAPI, userAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import PostCard from '../../components/Posts/PostCard';
import { toast } from 'react-toastify';
import {
  FaSignOutAlt, FaImage, FaVideo, FaTimes, FaTrash, FaArrowLeft, FaCamera, FaSearch,
  FaRegNewspaper, FaExclamationCircle,
} from 'react-icons/fa';
import GroupHero from '../../components/groups/GroupHero';
import MemberRow from '../../components/groups/MemberRow';
import { useAuth } from '../../context/AuthContext';
import { confirmDialog } from '../../utils/confirmDialog';
import '../../styles/Groups.css';

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
  const [showEditForm, setShowEditForm] = useState(false);
  const [editGroupData, setEditGroupData] = useState({
    name: '',
    description: '',
    is_private: false,
    cover_image: null,
  });
  const [updatingGroup, setUpdatingGroup] = useState(false);

  useEffect(() => {
    setLoading(true);
    loadGroupData();
  }, [groupId]);

  useEffect(() => {
    if (!showEditForm) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setShowEditForm(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showEditForm]);

  const extractItems = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.value)) return data.value;
    if (Array.isArray(data?.posts)) return data.posts;
    if (Array.isArray(data?.members)) return data.members;
    if (Array.isArray(data?.invited)) return data.invited;
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

      const role = getCurrentUserRole(groupData, membersData);
      if (groupData && role === 'admin') {
        setEditGroupData({
          name: groupData.name || '',
          description: groupData.description || '',
          is_private: groupData.is_private || false,
          cover_image: null,
        });
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
    const confirmed = await confirmDialog({
      title: 'Leave Group',
      message: 'Are you sure you want to leave this group?',
      confirmText: 'Leave',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await groupAPI.leaveGroup(groupId);
      toast.success('Left group successfully');
      navigate('/groups');
    } catch (error) {
      toast.error('Failed to leave group');
    }
  };

  const handleDeleteGroup = async () => {
    const confirmed = await confirmDialog({
      title: 'Delete Group',
      message: 'Delete this group permanently? This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

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
    const confirmed = await confirmDialog({
      title: 'Transfer Admin Rights',
      message: 'Transfer admin rights to this member?',
      confirmText: 'Transfer',
    });
    if (!confirmed) return;

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

      const invitedUserFromSearch = searchCandidates.find(
        (person) => String(person.user_id) === String(userId)
      );
      const invitedUserFromFollowers = followersToInvite.find(
        (person) => String(person.user_id) === String(userId)
      );
      const invitedUser = invitedUserFromSearch || invitedUserFromFollowers;

      setSearchCandidates((prev) =>
        prev.filter((person) => String(person.user_id) !== String(userId))
      );
      setFollowersToInvite((prev) =>
        prev.filter((person) => String(person.user_id) !== String(userId))
      );
      setInvitedMembers((prev) => {
        const alreadyInvited = prev.some(
          (member) => String(member.user_id) === String(userId)
        );
        if (alreadyInvited) return prev;

        return [
          ...prev,
          {
            user_id: userId,
            name: invitedUser?.name || 'User',
            profile_picture: invitedUser?.profile_picture,
            role: 'invited',
          },
        ];
      });

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
    const confirmed = await confirmDialog({
      title: 'Remove Member',
      message: 'Remove this member from the group?',
      confirmText: 'Remove',
      danger: true,
    });
    if (!confirmed) return;
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
      const memberIds = new Set(members.map((member) => String(member.user_id)));
      const pendingIds = new Set(pendingMembers.map((member) => String(member.user_id)));
      const invitedIds = new Set(invitedMembers.map((member) => String(member.user_id)));
      setSearchCandidates(
        users.filter(
          (item) =>
            !memberIds.has(String(item.user_id)) &&
            !pendingIds.has(String(item.user_id)) &&
            !invitedIds.has(String(item.user_id))
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

  const handleEditChange = (e) => {
    const { name, value, type, checked, files } = e.target;

    if (type === 'checkbox') {
      setEditGroupData((prev) => ({ ...prev, [name]: checked }));
    } else if (type === 'file') {
      setEditGroupData((prev) => ({ ...prev, cover_image: files[0] || null }));
    } else {
      setEditGroupData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    setUpdatingGroup(true);

    try {
      const formData = new FormData();
      if (editGroupData.name) formData.append('name', editGroupData.name);
      if (editGroupData.description) formData.append('description', editGroupData.description);
      formData.append('is_private', editGroupData.is_private);

      if (editGroupData.cover_image) {
        const uploadData = new FormData();
        uploadData.append('media', editGroupData.cover_image);
        uploadData.append('media_type', 'image');
        const uploadRes = await postAPI.uploadMedia(uploadData);
        const uploadedUrl = uploadRes?.data?.uploaded_files?.[0]?.url;
        if (uploadedUrl) formData.append('cover_image', uploadedUrl);
      }

      await groupAPI.updateGroup(groupId, formData);

      toast.success('Group updated successfully!');
      setShowEditForm(false);
      await loadGroupData();
      setActiveTab('posts');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to update group');
    } finally {
      setUpdatingGroup(false);
      setEditGroupData((prev) => ({ ...prev, cover_image: null }));
    }
  };

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

  const shell = (children) => (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container group-page">{children}</div>
      </div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="group-hero group-hero-skeleton" aria-busy="true" aria-label="Loading group">
        <span className="skel group-skel-hero-cover" />
        <div className="group-hero-body">
          <span className="skel group-skel-line" style={{ width: '40%', height: 24 }} />
          <span className="skel group-skel-line" style={{ width: '70%' }} />
        </div>
      </div>,
    );
  }

  if (!group) {
    return shell(
      <div className="state-card" role="alert">
        <FaExclamationCircle aria-hidden="true" />
        <strong>We couldn't load this group</strong>
        <p>It may have been removed, or you may not have access.</p>
        <div className="state-card-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setLoading(true); loadGroupData(); }}>
            Try again
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/groups')}>
            Back to groups
          </button>
        </div>
      </div>,
    );
  }

  const currentUserRole = getCurrentUserRole(group, members);
  const canManageMembers =
    currentUserRole === 'admin' ||
    currentUserRole === 'owner' ||
    currentUserRole === 'moderator';
  const canChangeRoles = currentUserRole === 'admin' || currentUserRole === 'owner';

  const roleBadge = (role) => {
    const value = String(role || 'member').toLowerCase();
    return value === 'member' ? null : value;
  };

  const tabs = [
    ['posts', 'Posts'],
    ['members', 'Members'],
    ...(canManageMembers ? [['dashboard', 'Admin']] : []),
  ];

  const coverTools = canChangeRoles && (
    <form className="cover-tools" onSubmit={handleUpdateCover}>
      <input
        id="group-cover-input"
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => setCoverImageFile(e.target.files?.[0] || null)}
      />
      {coverImageFile ? (
        <>
          <span className="cover-file-name">{coverImageFile.name}</span>
          <button type="submit" className="btn btn-primary btn-sm" disabled={updatingCover}>
            {updatingCover ? 'Saving...' : 'Save cover'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCoverImageFile(null)}>
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => document.getElementById('group-cover-input')?.click()}
        >
          <FaCamera aria-hidden="true" /> Change cover
        </button>
      )}
    </form>
  );

  const removePost = (postId) => setPosts((prev) => prev.filter((item) => item.id !== postId));

  return shell(
    <>
      <button type="button" className="back-link" onClick={() => navigate('/groups')}>
        <FaArrowLeft aria-hidden="true" /> All groups
      </button>

      <GroupHero
        group={group}
        groupId={groupId}
        memberCount={members.length}
        coverTools={coverTools}
        actions={
          <button type="button" className="btn btn-secondary" onClick={handleLeaveGroup}>
            <FaSignOutAlt aria-hidden="true" /> Leave
          </button>
        }
      />

      <div className="group-tabs" role="tablist" aria-label="Group sections">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`group-tab-${id}`}
            aria-selected={activeTab === id}
            aria-controls="group-panel"
            className={`tab ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
            {id === 'members' && <span className="tab-count">{members.length}</span>}
            {id === 'members' && canManageMembers && pendingMembers.length > 0 && (
              <span className="tab-badge" aria-label={`${pendingMembers.length} pending requests`}>
                {pendingMembers.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div id="group-panel" role="tabpanel" aria-labelledby={`group-tab-${activeTab}`} className="group-panel">
        {activeTab === 'posts' && (
          <div className="group-posts">
            <form onSubmit={handleCreatePost} className="create-post-card expanded group-composer">
              <textarea
                placeholder="Share something with the group"
                aria-label="Write a group post"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                rows="3"
              />

              <input
                id="group-post-photo-input"
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  const selected = Array.from(e.target.files || []);
                  if (selected.length > 0) setNewPostFiles((prev) => [...prev, ...selected]);
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
                  if (selected.length > 0) setNewPostFiles((prev) => [...prev, ...selected]);
                  e.target.value = '';
                }}
              />

              {newPostFiles.length > 0 && (
                <div className="selected-media-list">
                  {newPostFiles.map((file, index) => (
                    <span key={`${file.name}-${file.lastModified}`} className="selected-media-chip">
                      {file.name}
                      <button
                        type="button"
                        className="remove-media-chip"
                        onClick={() => setNewPostFiles((prev) => prev.filter((_, i) => i !== index))}
                        aria-label={`Remove ${file.name}`}
                      >
                        <FaTimes aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="composer-actions">
                <div className="media-buttons">
                  <button
                    type="button"
                    className="media-btn"
                    onClick={() => document.getElementById('group-post-photo-input')?.click()}
                  >
                    <FaImage aria-hidden="true" /> Photo
                  </button>
                  <button
                    type="button"
                    className="media-btn"
                    onClick={() => document.getElementById('group-post-video-input')?.click()}
                  >
                    <FaVideo aria-hidden="true" /> Video
                  </button>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creatingPost || (!newPostContent.trim() && newPostFiles.length === 0)}
                >
                  {creatingPost ? 'Posting...' : 'Post'}
                </button>
              </div>
            </form>

            {posts.length === 0 ? (
              <div className="state-card">
                <FaRegNewspaper aria-hidden="true" />
                <strong>No posts yet</strong>
                <p>Be the first to start a conversation in {group.name}.</p>
              </div>
            ) : (
              posts.map((post) => <PostCard key={post.id} post={post} onDelete={removePost} />)
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="group-members">
            {canManageMembers && pendingMembers.length > 0 && (
              <section className="side-card" aria-labelledby="pending-title">
                <h2 className="side-title" id="pending-title">Pending requests <span>{pendingMembers.length}</span></h2>
                <ul className="member-list">
                  {pendingMembers.map((member) => (
                    <MemberRow
                      key={member.user_id}
                      member={member}
                      actions={
                        <>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAcceptMember(member.user_id)}>
                            Accept
                          </button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRejectMember(member.user_id)}>
                            Reject
                          </button>
                        </>
                      }
                    />
                  ))}
                </ul>
              </section>
            )}

            {canManageMembers && (
              <section className="side-card" aria-labelledby="invite-title">
                <h2 className="side-title" id="invite-title">Invite people</h2>

                <form
                  className="invite-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearchUsers();
                  }}
                >
                  <FaSearch aria-hidden="true" />
                  <input
                    type="search"
                    placeholder="Search people by name, ID or email"
                    aria-label="Search people to invite"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={searchLoading}>
                    {searchLoading ? 'Searching...' : 'Search'}
                  </button>
                </form>

                {pagedSearchCandidates.length > 0 && (
                  <ul className="member-list">
                    {pagedSearchCandidates.map((person) => (
                      <MemberRow
                        key={person.user_id}
                        member={person}
                        actions={
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleInviteMember(person.user_id)}>
                            Invite
                          </button>
                        }
                      />
                    ))}
                  </ul>
                )}
                {searchCandidates.length > searchPageSize && (
                  <div className="pager">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSearchPage((page) => Math.max(1, page - 1))} disabled={searchPage === 1}>
                      Previous
                    </button>
                    <span>{searchPage} / {searchTotalPages}</span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSearchPage((page) => Math.min(searchTotalPages, page + 1))} disabled={searchPage >= searchTotalPages}>
                      Next
                    </button>
                  </div>
                )}

                <h3 className="side-subtitle">Your followers</h3>
                {followersToInvite.length === 0 ? (
                  <p className="text-muted">No followers available to invite.</p>
                ) : (
                  <ul className="member-list">
                    {pagedFollowers.map((person) => (
                      <MemberRow
                        key={person.user_id}
                        member={person}
                        actions={
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleInviteMember(person.user_id)}>
                            Invite
                          </button>
                        }
                      />
                    ))}
                  </ul>
                )}
                {followersToInvite.length > followersPageSize && (
                  <div className="pager">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFollowersPage((page) => Math.max(1, page - 1))} disabled={followersPage === 1}>
                      Previous
                    </button>
                    <span>{followersPage} / {followersTotalPages}</span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFollowersPage((page) => Math.min(followersTotalPages, page + 1))} disabled={followersPage >= followersTotalPages}>
                      Next
                    </button>
                  </div>
                )}

                {invitedMembers.length > 0 && (
                  <>
                    <h3 className="side-subtitle">Invited</h3>
                    <ul className="member-list">
                      {invitedMembers.map((member) => (
                        <MemberRow
                          key={member.user_id}
                          member={member}
                          badge="invited"
                          actions={
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleCancelInvite(member.user_id)}>
                              Cancel invite
                            </button>
                          }
                        />
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}

            <section className="side-card" aria-labelledby="members-title">
              <h2 className="side-title" id="members-title">Members <span>{members.length}</span></h2>
              <ul className="member-list">
                {members.map((member) => (
                  <MemberRow
                    key={member.user_id}
                    member={member}
                    badge={roleBadge(member.role)}
                    actions={
                      member.user_id !== currentUser?.id && (
                        <>
                          {canChangeRoles && (
                            <>
                              {member.role === 'moderator' ? (
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDemote(member.user_id)}>
                                  Demote
                                </button>
                              ) : (
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handlePromote(member.user_id)}>
                                  Make moderator
                                </button>
                              )}
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleTransferAdmin(member.user_id)}>
                                Make admin
                              </button>
                            </>
                          )}
                          {canManageMembers &&
                            !(currentUserRole === 'moderator' && (member.role === 'admin' || member.role === 'owner')) && (
                              <button type="button" className="btn btn-secondary btn-sm btn-quiet-danger" onClick={() => handleKickMember(member.user_id)}>
                                Remove
                              </button>
                            )}
                        </>
                      )
                    }
                  />
                ))}
              </ul>
            </section>
          </div>
        )}

        {activeTab === 'dashboard' && canManageMembers && (
          <div className="group-admin-dashboard">
            <section className="side-card">
              <h2 className="side-title">Group settings</h2>
              <p className="text-muted">Update the name, description, privacy and cover image.</p>
              <button type="button" className="btn btn-primary" onClick={() => setShowEditForm(true)}>
                Edit group
              </button>
            </section>

            <section className="side-card">
              <h2 className="side-title">Last 30 days</h2>
              <dl className="activity-list">
                {[
                  ['Posts', activity.posts_count],
                  ['Active members', activity.active_members_count],
                  ['New members', activity.new_members_count],
                  ['Likes', activity.total_likes],
                  ['Comments', activity.total_comments],
                  ['Pending requests', pendingMembers.length],
                  ['Total members', members.length],
                ].map(([label, value]) => (
                  <div className="activity-item" key={label}>
                    <dt>{label}</dt>
                    <dd>{value || 0}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {canChangeRoles && (
              <section className="side-card danger-zone">
                <h2 className="side-title">Delete group</h2>
                <p className="text-muted">Permanently deletes the group and all of its posts. This can't be undone.</p>
                <button type="button" className="btn btn-danger" onClick={handleDeleteGroup}>
                  <FaTrash aria-hidden="true" /> Delete group
                </button>
              </section>
            )}
          </div>
        )}
      </div>

      {showEditForm && (
        <div className="modal-overlay" onClick={() => setShowEditForm(false)}>
          <div
            className="modal-content large"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-group-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="edit-group-title">Edit group</h2>
              <button type="button" className="modal-close-btn" aria-label="Close" onClick={() => setShowEditForm(false)}>
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleUpdateGroup}>
              <div className="form-group">
                <label htmlFor="edit-group-name">Group name</label>
                <input id="edit-group-name" type="text" name="name" value={editGroupData.name} onChange={handleEditChange} required />
              </div>

              <div className="form-group">
                <label htmlFor="edit-group-description">Description</label>
                <textarea
                  id="edit-group-description"
                  name="description"
                  value={editGroupData.description}
                  onChange={handleEditChange}
                  rows="4"
                  placeholder="Describe the purpose of the group"
                />
              </div>

              <div className="form-group">
                <label id="edit-privacy-label">Privacy</label>
                <button
                  type="button"
                  className={`private-group-toggle ${editGroupData.is_private ? 'active' : ''}`}
                  aria-pressed={editGroupData.is_private}
                  aria-labelledby="edit-privacy-label"
                  onClick={() => setEditGroupData((prev) => ({ ...prev, is_private: !prev.is_private }))}
                >
                  <span className={`toggle-knob ${editGroupData.is_private ? 'active' : ''}`} />
                  <span className="private-group-toggle-text">
                    {editGroupData.is_private ? 'Private group' : 'Public group'}
                  </span>
                </button>
                <p className="private-group-helper">
                  Private groups require approval before people can see posts.
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="group-cover-image">Cover image</label>
                <input id="group-cover-image" type="file" accept="image/*" name="cover_image" onChange={handleEditChange} />
                {editGroupData.cover_image && (
                  <span className="cover-file-name">{editGroupData.cover_image.name}</span>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={updatingGroup}>
                  {updatingGroup ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>,
  );
};

export default GroupDetail;
