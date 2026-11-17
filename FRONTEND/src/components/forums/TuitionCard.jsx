import React from 'react';
import { Link } from 'react-router-dom';
import { FaMapMarkerAlt, FaMoneyBillWave, FaClock, FaPhoneAlt, FaUserFriends } from 'react-icons/fa';
import { timeAgo } from '../../utils/time';

const money = (value) => `৳${Number(value).toLocaleString('en-US')}`;

const capitalise = (value) => {
  const text = String(value || '');
  return text ? text[0].toUpperCase() + text.slice(1) : '';
};

const salaryText = (min, max) => {
  const hasMin = min !== null && min !== undefined && min !== '';
  const hasMax = max !== null && max !== undefined && max !== '';
  if (hasMin && hasMax) return `${money(min)} – ${money(max)} / month`;
  if (hasMin) return `From ${money(min)} / month`;
  if (hasMax) return `Up to ${money(max)} / month`;
  return '';
};

const TuitionCard = ({ post, posterId, isOwner, canMessage, onEdit, onDelete }) => {
  const seeking = post.post_type === 'seeking_tutor';
  const subjects = Array.isArray(post.subjects) ? post.subjects : [];
  const salary = salaryText(post.salary_min, post.salary_max);
  const message = `Hi, I am interested in your tuition post for ${post.class_level} at ${post.location}.`;
  const schedule = [
    post.days_per_week ? `${post.days_per_week} ${Number(post.days_per_week) === 1 ? 'day' : 'days'} / week` : '',
    post.duration_hours ? `${post.duration_hours} h per session` : '',
  ].filter(Boolean).join(' · ');

  return (
    <article className={`forum-card tuition-card ${seeking ? 'is-seeking' : 'is-offering'}`}>
      <div className="forum-card-main">
        <div className="forum-card-head">
          <div>
            <span className={`post-type-badge ${seeking ? 'seeking' : 'offering'}`}>
              {seeking ? 'Seeking a tutor' : 'Offering tuition'}
            </span>
            <h3>{post.class_level || 'Tuition'}</h3>
          </div>
          {post.status && <span className="status-badge">{post.status}</span>}
        </div>

        {subjects.length > 0 && (
          <ul className="subject-chips" aria-label="Subjects">
            {subjects.map((subject) => (
              <li key={subject} className="subject-chip">{subject}</li>
            ))}
          </ul>
        )}

        <ul className="forum-facts">
          {post.location && (
            <li><FaMapMarkerAlt aria-hidden="true" /><span>{post.location}</span></li>
          )}
          {salary && (
            <li><FaMoneyBillWave aria-hidden="true" /><span>{salary}</span></li>
          )}
          {schedule && (
            <li><FaClock aria-hidden="true" /><span>{schedule}</span></li>
          )}
          {post.preferred_gender && (
            <li>
              <FaUserFriends aria-hidden="true" />
              <span>
                {seeking ? 'Tutor' : 'Student'} preference: {capitalise(post.preferred_gender)}
              </span>
            </li>
          )}
          {post.contact_number && (
            <li><FaPhoneAlt aria-hidden="true" /><a href={`tel:${post.contact_number}`}>{post.contact_number}</a></li>
          )}
        </ul>

        {post.requirements && <p className="forum-card-text">{post.requirements}</p>}

        <div className="forum-card-foot">
          <span className="forum-time">Posted {timeAgo(post.created_at)}</span>
          <div className="forum-card-actions">
            {isOwner && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEdit(post)}>
                  Edit
                </button>
                <button type="button" className="btn btn-secondary btn-sm btn-quiet-danger" onClick={() => onDelete(post)}>
                  Delete or mark booked
                </button>
              </>
            )}
            {canMessage && (
              <Link to={`/chat/${posterId}?message=${encodeURIComponent(message)}`} className="btn btn-primary btn-sm">
                Message poster
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default TuitionCard;
