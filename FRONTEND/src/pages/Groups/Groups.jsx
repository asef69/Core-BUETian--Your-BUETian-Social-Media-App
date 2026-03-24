import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { groupAPI, userAPI } from "../../services/apiService";
import Navbar from "../../components/Navbar";
import { toast } from "react-toastify";
import { FaPlus, FaUsers, FaLock, FaGlobe } from "react-icons/fa";
import "../../styles/Groups.css";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Groups = () => {
  const { user: currentUser } = useAuth();
  const [myGroups, setMyGroups] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingGroupIds, setPendingGroupIds] = useState(new Set());
  const navigate = useNavigate();
  const [createData, setCreateData] = useState({
    name: "",
    description: "",
    is_private: false,
    cover_image: null,
  });

  useEffect(() => {
    loadGroups();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    try {
      const raw = sessionStorage.getItem(
        `pending_group_requests_${currentUser.id}`,
      );
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setPendingGroupIds(new Set(parsed.map((id) => Number(id))));
      }
    } catch {
      // Ignore invalid cached values.
    }
  }, [currentUser?.id]);

  const persistPendingGroups = (idsSet) => {
    if (!currentUser?.id) return;
    sessionStorage.setItem(
      `pending_group_requests_${currentUser.id}`,
      JSON.stringify(Array.from(idsSet)),
    );
  };

  const extractItems = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.value)) return data.value;
    if (Array.isArray(data?.groups)) return data.groups;
    if (Array.isArray(data?.my_groups)) return data.my_groups;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  };

  const getGroupId = (group) => group?.group_id || group?.id || group?.pk;

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
      .map((member) => (typeof member === "object" ? toUserId(member) : member))
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
            const memberStatus = String(group?.member_status || "").toLowerCase();
            if (memberStatus === "invited" || memberStatus === "pending") {
              return true;
            }

            const memberIds = getGroupMemberIds(group);
            if (memberIds.length === 0) return false;
            return memberIds.some((id) => socialIds.has(id));
          });
        }
      }

      setMyGroups(myGroupsData);
      setSuggested(
        filteredSuggested.length > 0 ? filteredSuggested : suggestedData,
      );

      const pendingFromApi = (filteredSuggested.length > 0
        ? filteredSuggested
        : suggestedData
      )
        .filter((group) => {
          const memberStatus = String(group?.member_status || "").toLowerCase();
          return memberStatus === "pending" || memberStatus === "invited";
        })
        .map((group) => Number(getGroupId(group)))
        .filter(Boolean);

      if (pendingFromApi.length > 0) {
        setPendingGroupIds((prev) => {
          const next = new Set([...prev, ...pendingFromApi]);
          persistPendingGroups(next);
          return next;
        });
      }
    } catch (error) {
      console.error("Error loading groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("name", createData.name);
      formData.append("description", createData.description);
      formData.append("is_private", createData.is_private);

      if (createData.cover_image) {
        formData.append("cover_image", createData.cover_image);
      }

      const res = await groupAPI.createGroup(formData);
      toast.success("Group created successfully!");
      setShowCreateModal(false);
      setCreateData({ name: "", description: "", is_private: false });
      loadGroups();
      navigate(`/groups/${res.data.group_id}`);
      setCreateData({
        name: "",
        description: "",
        is_private: false,
        cover_image: null,
      });
    } catch (error) {
      console.error(error.response || error);
      toast.error(error?.response?.data?.error || "Failed to create group");
    }
  };

  const handleJoinGroup = async (groupId) => {
    try {
      await groupAPI.joinGroup(groupId);
      setPendingGroupIds((prev) => {
        const next = new Set(prev);
        next.add(Number(groupId));
        persistPendingGroups(next);
        return next;
      });
      toast.success("Join request sent!");
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.response?.data?.error || "";

      if (/already sent/i.test(message)) {
        setPendingGroupIds((prev) => {
          const next = new Set(prev);
          next.add(Number(groupId));
          persistPendingGroups(next);
          return next;
        });
        toast.info("Join request already pending");
        return;
      }

      toast.error(message || "Failed to join group");
    }
  };
  const handleNonmemberView = (groupId) => {
    navigate(`/groups/${groupId}/nonmember`);
  };

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container">
          <div className="groups-header">
            <h1>Groups</h1>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
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
                    myGroups.map((group) => {
                      const groupId = getGroupId(group);
                      if (!groupId) return null;

                      return (
                        <Link
                          to={`/groups/${groupId}`}
                          key={groupId}
                          className="group-card"
                        >
                          <img
                            src={group.cover_image || "/default-group.png"}
                            alt={group.name}
                            className="group-cover"
                          />
                          <div className="group-info">
                            <h3>{group.name}</h3>
                            <p>{group.description}</p>
                            <div className="group-meta">
                              {group.is_private ? <FaLock /> : <FaGlobe />}
                              <span>
                                <FaUsers /> {group.members_count} members
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="groups-section">
                <h2>Suggested Groups</h2>
                <div className="groups-grid">
                  {suggested.length === 0 ? (
                    <p>No suggestions available</p>
                  ) : (
                    suggested.map((group) => {
                      const groupId = getGroupId(group);
                      if (!groupId) return null;
                      const memberStatus = String(group?.member_status || "").toLowerCase();
                      const isInvited = memberStatus === "invited";
                      const isPending = pendingGroupIds.has(Number(groupId)) || memberStatus === "pending";

                      return (
                        <div key={groupId} className="group-card">
                          <img
                            src={group.cover_image || "/default-group.png"}
                            alt={group.name}
                            className="group-cover"
                          />
                          <div className="group-info">
                            <h3>{group.name}</h3>
                            <p>{group.description}</p>
                            <div className="group-meta">
                              {group.is_private ? <FaLock /> : <FaGlobe />}
                              <span>
                                <FaUsers /> {group.members_count} members
                              </span>
                            </div>

                            <div className="group-card-actions">
                              <button
                                className="btn btn-secondary"
                                onClick={() => handleNonmemberView(groupId)}
                              >
                                View Group
                              </button>
                              {isInvited ? (
                                <button className="btn btn-secondary" disabled>
                                  Invited
                                </button>
                              ) : isPending ? (
                                <button className="btn btn-secondary" disabled>
                                  Request Pending
                                </button>
                              ) : (
                                <button
                                  className="btn btn-primary"
                                  onClick={() => handleJoinGroup(groupId)}
                                >
                                  Join Group
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {
        showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Create New Group</h2>

              <form onSubmit={handleCreateGroup}>

                {/* Group Name */}
                <div className="form-group">
                  <label>Group Name</label>
                  <input
                    type="text"
                    value={createData.name}
                    onChange={(e) =>
                      setCreateData({ ...createData, name: e.target.value })
                    }
                    required
                  />
                </div>

                {/* Description */}
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={createData.description}
                    onChange={(e) =>
                      setCreateData({ ...createData, description: e.target.value })
                    }
                    rows="3"
                  />
                </div>

                {/* Private checkbox */}
                <div className="form-group private-group-form-group">
                  <label className="private-group-label">Group Privacy</label>
                  <button
                    type="button"
                    className={`private-group-toggle ${createData.is_private ? 'active' : ''}`}
                    onClick={() =>
                      setCreateData({
                        ...createData,
                        is_private: !createData.is_private,
                      })
                    }
                    aria-pressed={createData.is_private}
                  >
                    <span className={`toggle-knob ${createData.is_private ? 'active' : ''}`} />
                    <span className="private-group-toggle-text">
                      {createData.is_private ? 'Private Group' : 'Public Group'}
                    </span>
                  </button>
                  <p className="private-group-helper">
                    {createData.is_private
                      ? 'Only approved members can join and view private content.'
                      : 'Anyone can discover and join this group.'}
                  </p>
                </div>

                {/* Cover Image Upload */}
                <div className="form-group">
                  <label>Cover Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setCreateData({
                        ...createData,
                        cover_image: e.target.files[0],
                      })
                    }
                  />

                  {createData.cover_image && (
                    <p className="file-name">
                      Selected: {createData.cover_image.name}
                    </p>
                  )}

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setCreateData({ ...createData, cover_image: null })}
                  >
                    Remove Image
                  </button>
                </div>

                {/* Preview */}
                {createData.cover_image && (
                  <div className="image-preview">
                    <img
                      src={URL.createObjectURL(createData.cover_image)}
                      alt="preview"
                      className="preview-img"
                    />
                  </div>
                )}

                {/* Buttons */}
                <div className="modal-actions">
                  <button type="submit" className="btn btn-primary">
                    Create
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div>
  );
};

export default Groups;
