import React from 'react';
import { Link } from 'react-router-dom';
import { FaGlobe, FaLock, FaUsers } from 'react-icons/fa';
import GroupCover from './GroupCover';

const initialsOf = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

/**
 * A group in a grid. The title link stretches over the whole card (see .group-card-title a::after),
 * so the card is one click target while buttons in `actions` stay independently clickable.
 */
const GroupCard = ({ group, groupId, to, actions = null }) => {
  const memberCount = Number(group.members_count) || 0;

  return (
    <article className="group-card">
      <GroupCover src={group.cover_image} seed={groupId} className="group-card-cover" />
      <div className="group-card-body">
        <span className="group-monogram" aria-hidden="true">{initialsOf(group.name)}</span>
        <h3 className="group-card-title">
          <Link to={to}>{group.name}</Link>
        </h3>
        {group.description && <p className="group-card-desc">{group.description}</p>}
        <ul className="group-card-meta">
          <li>
            <FaUsers aria-hidden="true" /> {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </li>
          <li>
            {group.is_private ? <FaLock aria-hidden="true" /> : <FaGlobe aria-hidden="true" />}
            {group.is_private ? 'Private' : 'Public'}
          </li>
        </ul>
      </div>
      {actions && <div className="group-card-actions">{actions}</div>}
    </article>
  );
};

export { initialsOf };
export default GroupCard;
