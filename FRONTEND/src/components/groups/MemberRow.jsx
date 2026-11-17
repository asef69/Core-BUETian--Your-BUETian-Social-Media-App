import React from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../common/Avatar';

/** One person in a group list: avatar, name, optional role badge, and an actions slot. */
const MemberRow = ({ member, badge = null, actions = null }) => (
  <li className="member-row">
    <Link to={`/profile/${member.user_id}`} className="member-row-person">
      <Avatar src={member.profile_picture} name={member.name} size={44} decorative />
      <span className="member-row-name">{member.name}</span>
      {badge && <span className={`role-badge role-${String(badge).toLowerCase()}`}>{badge}</span>}
    </Link>
    {actions && <div className="member-row-actions">{actions}</div>}
  </li>
);

export default MemberRow;
