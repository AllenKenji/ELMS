import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api/api';
import '../styles/PublicDetailPage.css';

function formatDate(value) {
  if (!value) return 'TBA';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'TBA';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(value) {
  if (!value) return 'TBA';
  const raw = String(value).slice(0, 5);
  const [hh, mm] = raw.split(':').map(Number);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return 'TBA';
  const normalizedHour = ((hh % 24) + 24) % 24;
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
  const hour12 = normalizedHour % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${suffix}`;
}

function resolveAssetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${API_BASE_URL}${raw}`;
  return `${API_BASE_URL}/${raw.replace(/^\/+/, '')}`;
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'LG';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
}

export default function PublicDetailPage() {
  const { entityType, id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailPhotoFailed, setDetailPhotoFailed] = useState(false);

  const endpoint = useMemo(() => {
    if (entityType === 'councilors') return `${API_BASE_URL}/public/councilors/${id}`;
    if (entityType === 'committees') return `${API_BASE_URL}/public/committees/${id}`;
    if (entityType === 'documents') {
      const [type = '', itemId = ''] = String(id || '').split('-');
      if (!type || !itemId) return null;
      return `${API_BASE_URL}/public/documents/${type}/${itemId}`;
    }
    return null;
  }, [entityType, id]);

  useEffect(() => {
    let mounted = true;

    async function loadDetails() {
      if (!endpoint) {
        setError('Unsupported public detail page.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setDetailPhotoFailed(false);
        const response = await axios.get(endpoint);
        if (!mounted) return;
        setData(response.data || null);
        setError('');
      } catch (err) {
        if (!mounted) return;
        setData(null);
        setError(err?.message || 'Failed to load public details.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDetails();
    return () => {
      mounted = false;
    };
  }, [endpoint]);

  const title = data?.name || data?.title || 'Public Details';
  const detailPhotoUrl = resolveAssetUrl(data?.photo_url);

  return (
    <div className="public-detail-page">
      <div className="detail-shell">
        <div className="detail-topbar">
          <Link to="/visit" className="detail-backlink">Back to Public Portal</Link>
          <Link to="/login" className="detail-login-link">Login</Link>
        </div>

        {loading && <p className="detail-note">Loading details...</p>}
        {!loading && error && <p className="detail-note error">{error}</p>}

        {!loading && data && (
          <main className="detail-grid">
            <section className="detail-primary-card">
              <p className="detail-eyebrow">Public Record</p>
              {entityType === 'councilors' && (
                <div className="detail-photo-panel">
                  {detailPhotoUrl && !detailPhotoFailed ? (
                    <img
                      src={detailPhotoUrl}
                      alt={`${title} profile`}
                      className="detail-profile-photo"
                      onError={() => setDetailPhotoFailed(true)}
                    />
                  ) : (
                    <div className="detail-profile-photo-placeholder">{getInitials(title)}</div>
                  )}
                </div>
              )}
              <h1>{title}</h1>

              {entityType === 'councilors' && (
                <>
                  <p className="detail-lead">{data.role || 'Legislative Officer'}</p>
                  <p>{data.bio}</p>
                  <dl className="detail-meta-list">
                    <div>
                      <dt>Email</dt>
                      <dd>{data.email || 'Not publicly listed'}</dd>
                    </div>
                    <div>
                      <dt>Committee Memberships</dt>
                      <dd>{data.committeeMemberships?.length || 0}</dd>
                    </div>
                  </dl>
                </>
              )}

              {entityType === 'committees' && (
                <>
                  <p className="detail-lead">{data.status || 'Committee'}</p>
                  <p>{data.description || 'No committee description available.'}</p>
                  <dl className="detail-meta-list">
                    <div>
                      <dt>Chair</dt>
                      <dd>{data.chair_name || 'Unassigned'}</dd>
                    </div>
                    <div>
                      <dt>Members</dt>
                      <dd>{data.members?.length || 0}</dd>
                    </div>
                  </dl>
                </>
              )}

              {entityType === 'documents' && (
                <>
                  <p className="detail-lead">{data.document_type} {data.reference_no ? `| ${data.reference_no}` : ''}</p>
                  <p>{data.description || 'No description available.'}</p>
                  <dl className="detail-meta-list">
                    <div>
                      <dt>Status</dt>
                      <dd>{data.status || 'Not specified'}</dd>
                    </div>
                    <div>
                      <dt>Stage</dt>
                      <dd>{data.reading_stage || 'Not specified'}</dd>
                    </div>
                    <div>
                      <dt>Proposer</dt>
                      <dd>{data.proposer_name || 'Not specified'}</dd>
                    </div>
                    <div>
                      <dt>Last Updated</dt>
                      <dd>{formatDate(data.updated_at)}</dd>
                    </div>
                  </dl>
                </>
              )}
            </section>

            <aside className="detail-secondary-card">
              {entityType === 'councilors' && (
                <>
                  <h2>Committee Assignments</h2>
                  {data.committeeMemberships?.length ? (
                    <div className="detail-stack-list">
                      {data.committeeMemberships.map((item) => (
                        <article key={`${item.id}-${item.committee_role}`} className="detail-mini-card">
                          <h3>{item.name}</h3>
                          <p>{item.committee_role}</p>
                          <p>Status: {item.status || 'Not specified'}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="detail-empty">No committee assignments are publicly listed.</p>
                  )}
                </>
              )}

              {entityType === 'committees' && (
                <>
                  <h2>Members</h2>
                  {data.members?.length ? (
                    <div className="detail-stack-list">
                      {data.members.map((member) => (
                        <article key={`${member.id}-${member.user_id}`} className="detail-mini-card">
                          <h3>{member.name}</h3>
                          <p>{member.role}</p>
                          <p>{member.email || 'Email not publicly listed'}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="detail-empty">No committee members are publicly listed.</p>
                  )}

                  <h2>Upcoming Meetings</h2>
                  {data.upcomingMeetings?.length ? (
                    <div className="detail-stack-list">
                      {data.upcomingMeetings.map((meeting) => (
                        <article key={meeting.id} className="detail-mini-card">
                          <h3>{meeting.title}</h3>
                          <p>{formatDate(meeting.meeting_date)} at {formatTime(meeting.meeting_time)}</p>
                          <p>{meeting.meeting_location || 'Location TBA'}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="detail-empty">No upcoming meetings are currently scheduled.</p>
                  )}
                </>
              )}

              {entityType === 'documents' && (
                <>
                  <h2>Document Summary</h2>
                  <article className="detail-rich-card">
                    <p>{data.remarks || 'No public remarks available.'}</p>
                  </article>

                  <h2>Content Preview</h2>
                  <article className="detail-rich-card prewrap">
                    <p>{data.content || 'No public document content available.'}</p>
                  </article>
                </>
              )}
            </aside>
          </main>
        )}
      </div>
    </div>
  );
}
