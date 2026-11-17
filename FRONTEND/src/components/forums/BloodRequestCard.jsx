import React from 'react';
import { Link } from 'react-router-dom';
import { FaPhoneAlt, FaMapMarkerAlt, FaCalendarAlt } from 'react-icons/fa';
import { formatDate, timeAgo, parseServerDate, dhakaDayKey } from '../../utils/time';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Needed today", "Needed in 3 days", "Was needed 2 days ago" (Bangladesh calendar days). */
const neededLabel = (neededDate) => {
  const needed = parseServerDate(neededDate);
  const today = parseServerDate(dhakaDayKey(new Date()));
  if (!needed || !today) return '';
  const days = Math.round((needed.getTime() - today.getTime()) / DAY_MS);
  if (days === 0) return 'Needed today';
  if (days === 1) return 'Needed tomorrow';
  if (days > 1) return `Needed in ${days} days`;
  return `Was needed ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ago`;
};

const URGENCY_LABEL = { low: 'Low', moderate: 'Moderate', urgent: 'Urgent' };

const BloodRequestCard = ({ request, isOwner, canMessage, onEdit, onDelete }) => {
  const urgency = String(request.urgency || 'moderate').toLowerCase();
  const message = `Hi, I saw your blood request for ${request.blood_group} at ${request.hospital_name}. I want to help.`;

  return (
    <article className={`forum-card blood-card urgency-${urgency}`}>
      <div className="blood-group-tile" aria-label={`Blood group ${request.blood_group}`}>
        {request.blood_group}
      </div>

      <div className="forum-card-main">
        <div className="forum-card-head">
          <h3>{request.patient_name}</h3>
          <div className="forum-chips">
            <span className={`urgency-chip urgency-${urgency}`}>{URGENCY_LABEL[urgency] || urgency}</span>
            {request.status && <span className="status-badge">{request.status}</span>}
          </div>
        </div>

        <ul className="forum-facts">
          <li>
            <FaMapMarkerAlt aria-hidden="true" />
            <span>
              {request.hospital_name}
              {request.hospital_address ? `, ${request.hospital_address}` : ''}
            </span>
          </li>
          <li>
            <FaCalendarAlt aria-hidden="true" />
            <span>
              {formatDate(request.needed_date)}
              <span className="forum-fact-note"> · {neededLabel(request.needed_date)}</span>
            </span>
          </li>
          {request.contact_number && (
            <li>
              <FaPhoneAlt aria-hidden="true" />
              <a href={`tel:${request.contact_number}`}>{request.contact_number}</a>
            </li>
          )}
        </ul>

        {request.description && <p className="forum-card-text">{request.description}</p>}

        <div className="forum-card-foot">
          <span className="forum-time">Posted {timeAgo(request.created_at)}</span>
          <div className="forum-card-actions">
            {isOwner && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEdit(request)}>
                  Edit
                </button>
                <button type="button" className="btn btn-secondary btn-sm btn-quiet-danger" onClick={() => onDelete(request)}>
                  Delete
                </button>
              </>
            )}
            {canMessage && (
              <Link
                to={`/chat/${request.requester_id}?message=${encodeURIComponent(message)}`}
                className="btn btn-primary btn-sm"
              >
                Message requester
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default BloodRequestCard;
