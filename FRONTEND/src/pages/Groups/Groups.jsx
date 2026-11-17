import React, { useState, useEffect, useMemo } from "react";
import { groupAPI, userAPI } from "../../services/apiService";
import Navbar from "../../components/Navbar";
import { toast } from "react-toastify";
import { FaPlus, FaUsers, FaSearch, FaExclamationCircle } from "react-icons/fa";
import GroupCard from "../../components/groups/GroupCard";
import "../../styles/Groups.css";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Groups = () => {
  const { user: currentUser } = useAuth();
  const [myGroups, setMyGroups] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
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
      setLoadError(false);
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

      const nextPendingIds = new Set(pendingFromApi);
      setPendingGroupIds(nextPendingIds);
      persistPendingGroups(nextPendingIds);
    } catch (error) {
      console.error("Error loading groups:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
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
    } finally {
      setCreating(false);
    }
  };

  const closeCreateModal = () => setShowCreateModal(false);

  // Cover preview: create the object URL once per file and release it afterwards.
  const coverPreview = useMemo(
    () => (createData.cover_image ? URL.createObjectURL(createData.cover_image) : null),
    [createData.cover_image],
  );
  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  useEffect(() => {
    if (!showCreateModal) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setShowCreateModal(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showCreateModal]);

  const handleJoinGroup = async (groupId) => {
    try {
      const response = await groupAPI.joinGroup(groupId);
      const message = String(response?.data?.message || '').toLowerCase();
      const isPendingJoin = message.includes('join request sent') || message.includes('already pending');

      setPendingGroupIds((prev) => {
        const next = new Set(prev);
        if (isPendingJoin) {
          next.add(Number(groupId));
        } else {
          next.delete(Number(groupId));
        }
        persistPendingGroups(next);
        return next;
      });

      toast.success(isPendingJoin ? "Join request sent!" : "Joined group successfully!");
      loadGroups();
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

  const query = search.trim().toLowerCase();
  const matchesQuery = (group) =>
    !query ||
    String(group?.name || "").toLowerCase().includes(query) ||
    String(group?.description || "").toLowerCase().includes(query);
  const visibleMine = myGroups.filter(matchesQuery);
  const visibleSuggested = suggested.filter(matchesQuery);

  const renderSkeletons = () => (
    <div className="groups-grid" aria-busy="true" aria-label="Loading groups">
      {[0, 1, 2].map((i) => (
        <div className="group-card group-card-skeleton" key={i} aria-hidden="true">
          <span className="skel group-skel-cover" />
          <div className="group-card-body">
            <span className="skel group-skel-line" style={{ width: "55%" }} />
            <span className="skel group-skel-line" style={{ width: "85%" }} />
            <span className="skel group-skel-line" style={{ width: "40%" }} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container groups-page">
          <div className="groups-header">
            <div>
              <h1>Groups</h1>
              <p className="page-subtitle">Find your people: batches, clubs, hobbies and study circles.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <FaPlus aria-hidden="true" /> Create group
            </button>
          </div>

          <div className="groups-search">
            <FaSearch aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groups"
              aria-label="Search groups"
            />
          </div>

          {loading ? (
            <>
              <h2 className="section-title">My groups</h2>
              {renderSkeletons()}
            </>
          ) : loadError ? (
            <div className="state-card" role="alert">
              <FaExclamationCircle aria-hidden="true" />
              <strong>Couldn't load groups</strong>
              <p>Check your connection and try again.</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setLoading(true);
                  loadGroups();
                }}
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <section className="groups-section" aria-labelledby="my-groups-title">
                <h2 className="section-title" id="my-groups-title">My groups</h2>
                {visibleMine.length === 0 ? (
                  <div className="state-card">
                    <FaUsers aria-hidden="true" />
                    <strong>{query ? "No matching groups" : "You haven't joined any groups yet"}</strong>
                    <p>
                      {query
                        ? "Try a different name."
                        : "Join one from the suggestions below, or start your own."}
                    </p>
                  </div>
                ) : (
                  <div className="groups-grid">
                    {visibleMine.map((group) => {
                      const groupId = getGroupId(group);
                      if (!groupId) return null;
                      return (
                        <GroupCard key={groupId} group={group} groupId={groupId} to={`/groups/${groupId}`} />
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="groups-section" aria-labelledby="discover-groups-title">
                <h2 className="section-title" id="discover-groups-title">Discover</h2>
                {visibleSuggested.length === 0 ? (
                  <div className="state-card">
                    <FaSearch aria-hidden="true" />
                    <strong>{query ? "No matching groups" : "No suggestions right now"}</strong>
                    <p>{query ? "Try a different name." : "Follow more people and suggestions will show up here."}</p>
                  </div>
                ) : (
                  <div className="groups-grid">
                    {visibleSuggested.map((group) => {
                      const groupId = getGroupId(group);
                      if (!groupId) return null;
                      const memberStatus = String(group?.member_status || "").toLowerCase();
                      const isInvited = memberStatus === "invited";
                      const isPending =
                        pendingGroupIds.has(Number(groupId)) || memberStatus === "pending";

                      return (
                        <GroupCard
                          key={groupId}
                          group={group}
                          groupId={groupId}
                          to={`/groups/${groupId}/nonmember`}
                          actions={
                            isInvited ? (
                              <span className="status-chip invited">Invited</span>
                            ) : isPending ? (
                              <span className="status-chip pending">Request pending</span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleJoinGroup(groupId)}
                              >
                                {group.is_private ? "Request to join" : "Join"}
                              </button>
                            )
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-group-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="create-group-title">Create a group</h2>

            <form onSubmit={handleCreateGroup}>
              <div className="form-group">
                <label htmlFor="group-name">Group name</label>
                <input
                  id="group-name"
                  type="text"
                  value={createData.name}
                  onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="group-description">Description</label>
                <textarea
                  id="group-description"
                  value={createData.description}
                  onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                  rows="3"
                  placeholder="What is this group about?"
                />
              </div>

              <div className="form-group private-group-form-group">
                <label id="group-privacy-label">Privacy</label>
                <button
                  type="button"
                  className={`private-group-toggle ${createData.is_private ? "active" : ""}`}
                  onClick={() => setCreateData({ ...createData, is_private: !createData.is_private })}
                  aria-pressed={createData.is_private}
                  aria-labelledby="group-privacy-label"
                >
                  <span className={`toggle-knob ${createData.is_private ? "active" : ""}`} />
                  <span className="private-group-toggle-text">
                    {createData.is_private ? "Private group" : "Public group"}
                  </span>
                </button>
                <p className="private-group-helper">
                  {createData.is_private
                    ? "Only approved members can join and view posts."
                    : "Anyone can discover and join this group."}
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="group-cover">Cover image (optional)</label>
                <input
                  id="group-cover"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setCreateData({ ...createData, cover_image: e.target.files[0] || null })
                  }
                />
              </div>

              {coverPreview && (
                <div className="image-preview">
                  <img src={coverPreview} alt="Cover preview" className="preview-img" />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCreateData({ ...createData, cover_image: null })}
                  >
                    Remove image
                  </button>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeCreateModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? "Creating..." : "Create group"}
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
