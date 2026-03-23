import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { groupAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import PostCard from '../../components/Posts/PostCard';
import { toast } from 'react-toastify';
import { FaArrowLeft, FaUsers, FaLock, FaGlobe, FaUserPlus, FaPaperPlane, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
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

const NonMemberGroupView = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const [group, setGroup] = useState(null);
    const [members, setMembers] = useState([]);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isInvited, setIsInvited] = useState(false);
    const [membershipStatus, setMembershipStatus] = useState('none');
    const [requestingJoin, setRequestingJoin] = useState(false);

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
                setMembershipStatus(groupRes?.data?.member_status || 'none');

                const membersRes = await groupAPI.getMembers(groupId);
                setMembers(extractItems(membersRes.data));

                const postsRes = await groupAPI.getGroupPosts(groupId);
                const rawPosts = extractItems(postsRes.data);

                const mappedPosts = rawPosts.map((p) => {
                    const author = p.author || p.user || {};
                    const name =
                        p.user_name ||
                        p.author_name ||
                        author.name ||
                        author.username ||
                        author.full_name ||
                        'Unknown';
                    const profile_picture =
                        p.profile_picture ||
                        p.author_profile_picture ||
                        author.profile_picture ||
                        author.avatar ||
                        '/default-avatar.png';

                    return {
                        ...p,
                        user_name: name,
                        profile_picture: profile_picture,
                        user_id: p.user_id || author.id,
                        likes_count: p.likes_count || 0,
                        comments_count: p.comments_count || 0,
                        created_at: p.created_at,
                    };
                });

                setPosts(mappedPosts);

                const invitesRes = await groupAPI.getInvites();
                const invites = Array.isArray(invitesRes?.data)
                    ? invitesRes.data
                    : Array.isArray(invitesRes?.data?.results)
                        ? invitesRes.data.results
                        : [];
                const invited = invites.some((inv) => String(inv.group_id) === String(groupId));
                setIsInvited(invited);

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadGroupData();
    }, [groupId]);

    const handleAcceptInvite = async () => {
        try {
            await groupAPI.acceptInvite(groupId);
            toast.success('Invitation accepted!');
            navigate(`/groups/${groupId}`);
        } catch (err) {
            console.error(err);
            toast.error('Failed to accept invite');
        }
    };

    const handleRejectInvite = async () => {
        try {
            await groupAPI.rejectInvite(groupId);
            toast.success('Invitation rejected');
            setIsInvited(false);
            setMembershipStatus('none');
        } catch (err) {
            console.error(err);
            toast.error('Failed to reject invite');
        }
    };

    const handleJoinRequest = async () => {
        try {
            setRequestingJoin(true);
            await groupAPI.joinGroup(groupId);
            setMembershipStatus('pending');
            toast.success(group?.is_private ? 'Join request sent' : 'Join request submitted');
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.error || 'Failed to send join request');
        } finally {
            setRequestingJoin(false);
        }
    };

    const canOpenGroup = membershipStatus === 'accepted' || group?.is_member === true;
    const isPending = membershipStatus === 'pending';

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
                            <div className="nonmember-badges">
                                {group.is_private ? (
                                    <span className="status-chip private">Private Group</span>
                                ) : (
                                    <span className="status-chip public">Public Group</span>
                                )}
                                {isInvited && <span className="status-chip invited">Invited</span>}
                                {isPending && <span className="status-chip pending">Request Pending</span>}
                            </div>
                        </div>
                    </div>

                    {/* Posts */}
                    <div className="group-posts">
                        <h2>Posts</h2>
                        {posts.length === 0 ? (
                            <p>No posts yet</p>
                        ) : (
                            posts.map((post) => <PostCard key={post.id || post.post_id} post={post} />)
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
                                            src={toAbsoluteUrl(m.profile_picture) || '/default-avatar.png'}
                                            alt={m.name || 'User'}
                                            className="avatar"
                                            onError={(e) => setFallbackOnce(e, '/default-avatar.png')}
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

                <div className="nonmember-actions-panel">
                    {isInvited && (
                        <>
                            <button className="btn btn-primary" onClick={handleAcceptInvite}>
                                <FaCheckCircle /> Accept Invitation
                            </button>
                            <button className="btn btn-secondary" onClick={handleRejectInvite}>
                                <FaTimesCircle /> Reject Invitation
                            </button>
                        </>
                    )}

                    {!isInvited && !canOpenGroup && !isPending && (
                        <button className="btn btn-primary" onClick={handleJoinRequest} disabled={requestingJoin}>
                            {group?.is_private ? <FaPaperPlane /> : <FaUserPlus />}
                            {requestingJoin ? 'Sending...' : group?.is_private ? 'Send Join Request' : 'Join Group'}
                        </button>
                    )}

                    {!isInvited && isPending && (
                        <button className="btn btn-secondary" disabled>
                            <FaPaperPlane /> Join Request Sent
                        </button>
                    )}

                    {canOpenGroup && (
                        <button className="btn btn-primary" onClick={() => navigate(`/groups/${groupId}`)}>
                            Open Group
                        </button>
                    )}

                    <button className="btn btn-secondary" onClick={() => navigate('/groups')}>
                        <FaArrowLeft /> Back to All Groups
                    </button>
                </div>

            </div>
        </div>
    );
};

export default NonMemberGroupView;