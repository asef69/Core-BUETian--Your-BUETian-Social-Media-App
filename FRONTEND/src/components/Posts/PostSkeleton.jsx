import React from 'react';

/** Placeholder shaped like a PostCard, shown while the feed loads. */
const PostSkeleton = ({ withMedia = false }) => (
  <div className="post-card post-skeleton" aria-hidden="true">
    <div className="post-header">
      <span className="skel post-skel-avatar" />
      <span className="post-skel-lines">
        <span className="skel post-skel-line" style={{ width: '38%' }} />
        <span className="skel post-skel-line post-skel-thin" style={{ width: '24%' }} />
      </span>
    </div>
    <div className="post-content">
      <span className="skel post-skel-line" style={{ width: '92%' }} />
      <span className="skel post-skel-line" style={{ width: '78%' }} />
      {withMedia && <span className="skel post-skel-media" />}
    </div>
  </div>
);

export default PostSkeleton;
