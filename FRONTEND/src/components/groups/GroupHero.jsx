import React from 'react';
import { FaGlobe, FaLock, FaUsers } from 'react-icons/fa';
import GroupCover from './GroupCover';
import { initialsOf } from './GroupCard';

/** Header shared by the member view and the non-member preview of a group. */
const GroupHero = ({ group, groupId, memberCount, chips = null, coverTools = null, actions = null }) => (
  <header className="group-hero">
    <GroupCover src={group.cover_image} seed={groupId} className="group-hero-cover">
      {coverTools}
    </GroupCover>
    <div className="group-hero-body">
      <span className="group-monogram group-monogram-lg" aria-hidden="true">{initialsOf(group.name)}</span>
      <div className="group-hero-main">
        <div className="group-hero-title">
          <h1>{group.name}</h1>
          {actions && <div className="group-hero-actions">{actions}</div>}
        </div>
        {group.description && <p className="group-hero-desc">{group.description}</p>}
        <ul className="group-card-meta">
          <li>
            <FaUsers aria-hidden="true" /> {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </li>
          <li>
            {group.is_private ? <FaLock aria-hidden="true" /> : <FaGlobe aria-hidden="true" />}
            {group.is_private ? 'Private group' : 'Public group'}
          </li>
        </ul>
        {chips && <div className="group-chips">{chips}</div>}
      </div>
    </div>
  </header>
);

export default GroupHero;
