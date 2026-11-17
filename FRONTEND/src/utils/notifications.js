// Where a notification should take the user. Returns '#' when it has no destination.
export const getNotificationLink = (notif) => {
  const type = notif.notification_type || notif.type;
  const postReferenceId = Number.parseInt(notif.post_reference_id, 10);
  const referenceId = notif.reference_id || notif.target_id;
  const normalizedReferenceId = Number.parseInt(referenceId, 10);
  const content = String(notif.content || '').toLowerCase();

  const isBlogContent = content.includes('blog');

  if (
    ['blog_like', 'blog_comment', 'blog_reply', 'blog_comment_like'].includes(type)
    && Number.isFinite(normalizedReferenceId)
    && normalizedReferenceId > 0
  ) {
    return `/blogs/${normalizedReferenceId}`;
  }

  if (
    ['like', 'comment', 'reply'].includes(type)
    && isBlogContent
    && Number.isFinite(normalizedReferenceId)
    && normalizedReferenceId > 0
  ) {
    return `/blogs/${normalizedReferenceId}`;
  }

  switch (type) {
    case 'like':
    case 'comment':
    case 'reply':
      if (!Number.isFinite(postReferenceId) || postReferenceId <= 0) return '#';
      return `/posts/${postReferenceId}`;
    case 'follow':
    case 'follow_request':
    case 'follow_accepted':
      return `/profile/${notif.actor_id}`;
    case 'group_invite':
    case 'group_join_request':
      if (!Number.isFinite(normalizedReferenceId) || normalizedReferenceId <= 0) return '#';
      return `/groups/${referenceId}`;
    case 'message':
      return `/chat/${notif.actor_id}`;
    default:
      return '#';
  }
};
