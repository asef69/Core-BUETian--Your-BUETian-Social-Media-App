import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { groupAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import PostCard from '../../components/Posts/PostCard';
import PostSkeleton from '../../components/Posts/PostSkeleton';
import GroupHero from '../../components/groups/GroupHero';
import MemberRow from '../../components/groups/MemberRow';
import { toast } from 'react-toastify';
import {
    FaArrowLeft, FaUserPlus, FaPaperPlane, FaCheckCircle, FaTimesCircle, FaLock, FaExclamationCircle,
} from 'react-icons/fa';
import '../../styles/Groups.css';

const MEMBER_PREVIEW_LIMIT = 12;

const extractItems = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.posts)) return data.posts;
    return [];
};

const NonMemberGroupView = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const [group, setGroup] = useState(null);
    const [members, setMembers] = useState([]);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [isInvited, setIsInvited] = useState(false);
    const [membershipStatus, setMembershipStatus] = useState('none');
    const [requestingJoin, setRequestingJoin] = useState(false);
    const [canViewPosts, setCanViewPosts] = useState(false);

    const loadGroupData = async () => {
        try {
            setLoadError(false);
            const groupRes = await groupAPI.getGroup(groupId);
            const groupData = groupRes.data;
            const initialMembershipStatus = groupData?.member_status || 'none';

            setGroup(groupData);
            setMembershipStatus(initialMembershipStatus);

            const canOpenBasedOnStatus =
                groupData?.is_member === true || initialMembershipStatus === 'accepted';
            const allowPosts = !groupData?.is_private || canOpenBasedOnStatus;
            setCanViewPosts(allowPosts);

            const membersRes = await groupAPI.getMembers(groupId);
            setMembers(extractItems(membersRes.data));

            if (allowPosts) {
                const postsRes = await groupAPI.getGroupPosts(groupId);
                const mappedPosts = extractItems(postsRes.data).map((p) => {
                    const author = p.author || p.user || {};
                    return {
                        ...p,
                        user_name:
                            p.user_name || p.author_name || author.name || author.username || author.full_name || 'Unknown',
                        profile_picture:
                            p.profile_picture || p.author_profile_picture || author.profile_picture || author.avatar,
                        user_id: p.user_id || author.id,
                        likes_count: p.likes_count || 0,
                        comments_count: p.comments_count || 0,
                    };
                });
                setPosts(mappedPosts);
            } else {
                setPosts([]);
            }

            const invitesRes = await groupAPI.getInvites();
            const invites = extractItems(invitesRes?.data);
            setIsInvited(
                initialMembershipStatus === 'invited' ||
                invites.some((inv) => String(inv.group_id) === String(groupId)),
            );
        } catch (err) {
            console.error(err);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        loadGroupData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            if (group?.is_private) {
                setMembershipStatus('pending');
                toast.success('Join request sent');
            } else {
                setMembershipStatus('accepted');
                setCanViewPosts(true);
                toast.success('Joined group successfully');
            }
        } catch (err) {
            console.error(err);
            toast.error(
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                'Failed to send join request',
            );
        } finally {
            setRequestingJoin(false);
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

    if (loadError || !group) {
        return shell(
            <div className="state-card" role="alert">
                <FaExclamationCircle aria-hidden="true" />
                <strong>We couldn't load this group</strong>
                <p>It may have been removed, or the connection dropped.</p>
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

    const canOpenGroup = membershipStatus === 'accepted' || group?.is_member === true;
    const isPending = membershipStatus === 'pending';
    const isInvitedState = isInvited || membershipStatus === 'invited';

    const actions = (
        <>
            {isInvitedState && (
                <>
                    <button type="button" className="btn btn-primary" onClick={handleAcceptInvite}>
                        <FaCheckCircle aria-hidden="true" /> Accept invitation
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={handleRejectInvite}>
                        <FaTimesCircle aria-hidden="true" /> Decline
                    </button>
                </>
            )}
            {!isInvitedState && !canOpenGroup && !isPending && (
                <button type="button" className="btn btn-primary" onClick={handleJoinRequest} disabled={requestingJoin}>
                    {group?.is_private ? <FaPaperPlane aria-hidden="true" /> : <FaUserPlus aria-hidden="true" />}
                    {requestingJoin ? 'Sending...' : group?.is_private ? 'Request to join' : 'Join group'}
                </button>
            )}
            {!isInvitedState && isPending && (
                <button type="button" className="btn btn-secondary" disabled>
                    <FaPaperPlane aria-hidden="true" /> Request sent
                </button>
            )}
            {canOpenGroup && (
                <button type="button" className="btn btn-primary" onClick={() => navigate(`/groups/${groupId}`)}>
                    Open group
                </button>
            )}
        </>
    );

    return shell(
        <>
            <button type="button" className="back-link" onClick={() => navigate('/groups')}>
                <FaArrowLeft aria-hidden="true" /> All groups
            </button>

            <GroupHero
                group={group}
                groupId={groupId}
                memberCount={members.length}
                actions={actions}
                chips={
                    <>
                        {isInvitedState && <span className="status-chip invited">Invited</span>}
                        {isPending && <span className="status-chip pending">Request pending</span>}
                    </>
                }
            />

            <div className="group-columns">
                <section className="group-main" aria-labelledby="group-posts-title">
                    <h2 className="section-title" id="group-posts-title">Posts</h2>
                    {!canViewPosts && group?.is_private ? (
                        <div className="state-card">
                            <FaLock aria-hidden="true" />
                            <strong>This group is private</strong>
                            <p>Posts are visible to members once your request is accepted.</p>
                        </div>
                    ) : posts.length === 0 ? (
                        <div className="state-card">
                            <strong>No posts yet</strong>
                            <p>When members post, you'll see their updates here.</p>
                        </div>
                    ) : (
                        posts.map((post) => <PostCard key={post.id || post.post_id} post={post} readOnly />)
                    )}
                </section>

                <aside className="group-side" aria-labelledby="group-members-title">
                    <div className="side-card">
                        <h2 className="side-title" id="group-members-title">
                            Members <span>{members.length}</span>
                        </h2>
                        {members.length === 0 ? (
                            <p className="text-muted">No members yet.</p>
                        ) : (
                            <ul className="member-list">
                                {members.slice(0, MEMBER_PREVIEW_LIMIT).map((m) => (
                                    <MemberRow
                                        key={m.user_id || m.id}
                                        member={{ ...m, user_id: m.user_id || m.id }}
                                    />
                                ))}
                            </ul>
                        )}
                        {members.length > MEMBER_PREVIEW_LIMIT && (
                            <p className="text-muted side-more">
                                and {members.length - MEMBER_PREVIEW_LIMIT} more
                            </p>
                        )}
                    </div>
                </aside>
            </div>
        </>,
    );
};

export default NonMemberGroupView;
