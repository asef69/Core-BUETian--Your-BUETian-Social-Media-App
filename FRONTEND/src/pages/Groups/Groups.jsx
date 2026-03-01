import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { groupAPI, userAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import { toast } from 'react-toastify';
import { FaPlus, FaUsers, FaLock, FaGlobe } from 'react-icons/fa';
import '../../styles/Groups.css';
import { useAuth } from '../../context/AuthContext';

const Groups = () => {
  const { user: currentUser } = useAuth();
  const [myGroups, setMyGroups] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createData, setCreateData] = useState({
    name: '',
    description: '',
    is_private: false,
  });

  useEffect(() => {
    loadGroups();
  }, [currentUser?.id]);

  const extractItems = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.value)) return data.value;
    return [];
  };

  const toUserId = (item) =>
    item?.user_id ||
    item?.id ||
    item?.follower_id ||
    item?.following_id ||
    item?.followed_id ||
    item?.follower?.id ||
    item?.following?.id ||
    item?.user?.id;

  const getGroupMemberIds = (group) => {
    const rawMembers =
      group?.member_ids ||
      group?.members ||
      group?.members_list ||
      group?.member_list ||
      group?.memberIds;
    if (!Array.isArray(rawMembers)) return [];
    return rawMembers
      .map((member) => (typeof member === 'object' ? toUserId(member) : member))
      .filter(Boolean);
  };

  const loadGroups = async () => {
    try {
      const requests = [groupAPI.getUserGroups(), groupAPI.getSuggested()];
      if (currentUser?.id) {
        requests.push(userAPI.getFollowers(currentUser.id));
        requests.push(userAPI.getFollowing(currentUser.id));
      }

      const responses = await Promise.all(requests);
      const myGroupsRes = responses[0];
      const suggestedRes = responses[1];
      const followersRes = responses[2];
      const followingRes = responses[3];

      const myGroupsData = extractItems(myGroupsRes.data);
      const suggestedData = extractItems(suggestedRes.data);

      let filteredSuggested = suggestedData;
      if (followersRes && followingRes) {
        const followerIds = extractItems(followersRes.data)
          .map(toUserId)
          .filter(Boolean);
        const followingIds = extractItems(followingRes.data)
          .map(toUserId)
          .filter(Boolean);
        const socialIds = new Set([...followerIds, ...followingIds]);

        if (socialIds.size > 0) {
          filteredSuggested = suggestedData.filter((group) => {
            const memberIds = getGroupMemberIds(group);
            if (memberIds.length === 0) return false;
            return memberIds.some((id) => socialIds.has(id));
          });
        }
      }

      setMyGroups(myGroupsData);
      setSuggested(filteredSuggested.length > 0 ? filteredSuggested : suggestedData);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      await groupAPI.createGroup(createData);
      toast.success('Group created successfully!');
      setShowCreateModal(false);
      setCreateData({ name: '', description: '', is_private: false });
      loadGroups();
    } catch (error) {
      toast.error('Failed to create group');
    }
  };

  const handleJoinGroup = async (groupId) => {
    try {
      await groupAPI.joinGroup(groupId);
      toast.success('Join request sent!');
      loadGroups();
    } catch (error) {
      toast.error('Failed to join group');
    }
  };

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container">
          <div className="groups-header">
            <h1>Groups</h1>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <FaPlus /> Create Group
            </button>
          </div>

          {loading ? (
            <div className="loading">Loading groups...</div>
          ) : (
            <>
              <section className="groups-section">
                <h2>My Groups</h2>
                <div className="groups-grid">
                  {myGroups.length === 0 ? (
                    <p>You haven't joined any groups yet</p>
                  ) : (
                    myGroups.map((group) => (
                      <Link to={`/groups/${group.group_id}`} key={group.group_id} className="group-card">
                        <img
                          src={group.cover_image || '/default-group.png'}
                          alt={group.name}
                          className="group-cover"
                        />
                        <div className="group-info">
                          <h3>{group.name}</h3>
                          <p>{group.description}</p>
                          <div className="group-meta">
                            {group.is_private ? <FaLock /> : <FaGlobe />}
                            <span><FaUsers /> {group.members_count} members</span>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </section>

              <section className="groups-section">
                <h2>Suggested Groups</h2>
                <div className="groups-grid">
                  {suggested.length === 0 ? (
                    <p>No suggestions available</p>
                  ) : (
                    suggested.map((group) => (
                      <div key={group.group_id} className="group-card">
                        <img
                          src={group.cover_image || '/default-group.png'}
                          alt={group.name}
                          className="group-cover"
                        />
                        <div className="group-info">
                          <h3>{group.name}</h3>
                          <p>{group.description}</p>
                          <div className="group-meta">
                            {group.is_private ? <FaLock /> : <FaGlobe />}
                            <span><FaUsers /> {group.members_count} members</span>
                          </div>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleJoinGroup(group.group_id)}
                          >
                            Join Group
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Group</h2>
            <form onSubmit={handleCreateGroup}>
              <div className="form-group">
                <label>Group Name</label>
                <input
                  type="text"
                  value={createData.name}
                  onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={createData.description}
                  onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={createData.is_private}
                    onChange={(e) => setCreateData({ ...createData, is_private: e.target.checked })}
                  />
                  Private Group
                </label>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Create</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
