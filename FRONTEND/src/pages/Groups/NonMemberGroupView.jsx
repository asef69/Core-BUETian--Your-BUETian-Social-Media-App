import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { groupAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import { FaArrowLeft, FaUsers, FaLock, FaGlobe } from 'react-icons/fa';
import '../../styles/Groups.css';


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

const NonMemberGroupView = ({ currentUserId, groupInvites }) => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const [group, setGroup] = useState(null);
    const [members, setMembers] = useState([]);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isInvited, setIsInvited] = useState(false);

    useEffect(() => {
        const loadGroupData = async () => {
            try {
                const extractItems = (data) => {
                    if (Array.isArray(data)) return data;
                    if (Array.isArray(data?.results)) return data.results;
                    if (Array.isArray(data?.data)) return data.data;
                    if (Array.isArray(data?.posts)) return data.posts;
                    return [];
                };

                const groupRes = await groupAPI.getGroup(groupId);
                setGroup(groupRes.data);

                const membersRes = await groupAPI.getMembers(groupId);
                setMembers(extractItems(membersRes.data));

                const postsRes = await groupAPI.getGroupPosts(groupId);
                const rawPosts = extractItems(postsRes.data);

                const mappedPosts = rawPosts.map((p) => {
                    const author = p.author || p.user || {};
                    const name = author.name || author.username || author.full_name || 'Unknown';
                    const profile_picture = author.profile_picture || author.avatar || '/default-avatar.png';

                    return {
                        ...p,
                        author_name: name,
                        author_profile_picture: profile_picture,
                        likes_count: p.likes_count || 0,
                    };
                });

                setPosts(mappedPosts);

                // Check if the current user is invited
                const invited = groupInvites?.some(inv => inv.group_id.toString() === groupId.toString());
                setIsInvited(invited);

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadGroupData();
    }, [groupId, groupInvites]);

    const handleAcceptInvite = async () => {
        try {
            await groupAPI.acceptInvite(groupId);
            alert('Invitation accepted!');
            navigate(`/groups/${groupId}`); // navigate to normal group view
        } catch (err) {
            console.error(err);
            alert('Failed to accept invite');
        }
    };

    const handleRejectInvite = async () => {
        try {
            await groupAPI.rejectInvite(groupId);
            alert('Invitation rejected!');
            navigate('/groups'); // back to all groups
        } catch (err) {
            console.error(err);
            alert('Failed to reject invite');
        }
    };

    if (loading) return <div className="loading">Loading group...</div>;
    if (!group) return <div>Group not found</div>;

    return (
        <div className="app-layout">
            <Navbar />
            <div className="main-content container">

                {/* Group Cover */}
                <div className="group-detail">
                    <div className="group-header">
                        <div className="group-cover-wrapper">
                            <img
                                src={group.cover_image || '/default-group.png'}
                                alt={group.name}
                                className="group-cover-large"
                                onError={(e) => { e.target.src = '/default-group.png'; }}
                            />
                            <div className="group-cover-overlay" />
                        </div>
                        <div className="group-info">
                            <h1>{group.name}</h1>
                            <p>{group.description}</p>
                            <div className="group-meta">
                                {group.is_private ? <FaLock /> : <FaGlobe />}
                                <span><FaUsers /> {members.length} members</span>
                            </div>
                        </div>
                    </div>

                    {/* Posts */}
                    <div className="group-posts">
                        <h2>Posts</h2>
                        {posts.length === 0 ? (
                            <p>No posts yet</p>
                        ) : (
                            posts.map((post) => (
                                <div key={post.id} className="post-card read-only">
                                    <div className="post-author">
                                        <img
                                            src={toAbsoluteUrl(post.profile_picture) || '/default-avatar.png'}
                                            alt={post.author_name}
                                            className="avatar"
                                            onError={(e) => setFallbackOnce(e, '/default-avatar.png')}
                                        />
                                        <span className="author-name">{post.author_name}</span>
                                    </div>
                                    <div className="post-content">
                                        <p>{post.content}</p>
                                    </div>
                                    <div className="post-likes">
                                        <span>{post.likes_count || 0} Likes</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Members */}
                    <div className="group-members">
                        <h2>Members</h2>
                        {members.length === 0 ? (
                            <p>No members yet.</p>
                        ) : (
                            <div className="members-grid">
                                {members.map((m) => (
                                    <div key={m.user_id || m.id} className="member-item">
                                        <img
                                            src={m.profile_picture || '/default-avatar.png'}
                                            alt={m.name || 'User'}
                                            className="avatar"
                                            onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                        />
                                        <div className="member-info">
                                            <h4>{m.name}</h4>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>

                {isInvited ? (
                    <div className="invite-actions">
                        <button className="btn btn-primary" onClick={handleAcceptInvite}>Accept Invitation</button>
                        <button className="btn btn-secondary" onClick={handleRejectInvite}>Reject Invitation</button>
                    </div>
                ) : (
                    <button className="btn btn-secondary mb-3" onClick={() => navigate('/groups')}>
                        <FaArrowLeft /> Back to All Groups
                    </button>
                )}

            </div>
        </div>
    );
};

export default NonMemberGroupView;