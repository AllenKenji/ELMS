import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api/api';
import '../styles/PublicLGUPage.css';

const fallbackData = {
  lguName: 'Local Government Unit',
  about:
    'This portal provides public visibility into council composition, legislative documents, committee structure, and official schedules.',
  branding: {
    logoUrl: '',
    sealUrl: '',
    officeName: 'Legislative Office',
    address: 'Municipal Hall, Main Civic Center',
    phone: '(000) 000-0000',
    email: 'legislative.office@lgu.gov.ph',
    officeHours: 'Monday to Friday, 8:00 AM to 5:00 PM',
  },
  councilors: [],
  legislativeDocuments: [],
  committees: [],
  scheduledSessions: [],
  scheduledMeetings: [],
};

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

export default function PublicLGUPage() {
  const [data, setData] = useState(fallbackData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [globalQuery, setGlobalQuery] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadOverview() {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/public/overview`);
        if (!mounted) return;

        setData({
          ...fallbackData,
          ...(response.data || {}),
        });
        setError('');
      } catch {
        if (!mounted) return;
        setError('Live data is temporarily unavailable. Showing basic page content.');
        setData(fallbackData);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadOverview();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(
    () => [
      { label: 'Council Members', value: data.councilors.length },
      { label: 'Legislative Docs', value: data.legislativeDocuments.length },
      { label: 'Committees', value: data.committees.length },
      { label: 'Upcoming Schedules', value: data.scheduledSessions.length + data.scheduledMeetings.length },
    ],
    [data]
  );

  const normalizedQuery = globalQuery.trim().toLowerCase();

  const filteredCouncilors = useMemo(() => {
    return data.councilors.filter((member) => {
      if (!normalizedQuery) return true;
      const haystack = `${member.name || ''} ${member.role || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [data.councilors, normalizedQuery]);

  const filteredCommittees = useMemo(() => {
    return data.committees.filter((committee) => {
      return !normalizedQuery || `${committee.name || ''} ${committee.description || ''} ${committee.chair_name || ''} ${committee.status || ''}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [data.committees, normalizedQuery]);

  const filteredDocuments = useMemo(() => {
    return data.legislativeDocuments.filter((doc) => {
      return !normalizedQuery || `${doc.title || ''} ${doc.reference_no || ''} ${doc.status || ''} ${doc.description || ''} ${doc.document_type || ''} ${doc.reading_stage || ''}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [data.legislativeDocuments, normalizedQuery]);

  const filteredSessions = useMemo(() => {
    return data.scheduledSessions.filter((session) => {
      if (!normalizedQuery) return true;
      const haystack = `${session.title || ''} ${session.location || ''} ${session.agenda || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [data.scheduledSessions, normalizedQuery]);

  const filteredMeetings = useMemo(() => {
    return data.scheduledMeetings.filter((meeting) => {
      if (!normalizedQuery) return true;
      const haystack = `${meeting.title || ''} ${meeting.committee_name || ''} ${meeting.meeting_location || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [data.scheduledMeetings, normalizedQuery]);

  const nextSession = filteredSessions[0] || data.scheduledSessions[0] || null;
  const nextMeeting = filteredMeetings[0] || data.scheduledMeetings[0] || null;
  const logoUrl = resolveAssetUrl(data.branding?.logoUrl);
  const sealUrl = resolveAssetUrl(data.branding?.sealUrl);

  return (
    <div className="public-lgu-page">
      <header className="public-header">
        <div className="hero-brand-slot hero-brand-slot-left" aria-hidden="true">
          {logoUrl ? (
            <img src={logoUrl} alt="LGU logo" className="hero-brand-image" />
          ) : (
            <div className="hero-brand-placeholder">Logo</div>
          )}
        </div>

        <div className="hero-content-shell">
          <div className="brand-block">
            <p className="eyebrow">Official Public Portal</p>
            <h1>{data.lguName} Legislative Council</h1>
            <p className="lead-text">A public window into your local legislative work and schedules.</p>
            <div className="hero-actions">
              <a href="#documents" className="secondary-cta">Browse Documents</a>
              <a href="#schedules" className="secondary-cta muted">See Schedules</a>
            </div>
          </div>

          <nav className="top-nav" aria-label="Public navigation">
            <a href="#councilors">Councilors</a>
            <a href="#documents">Documents</a>
            <a href="#committees">Committees</a>
            <a href="#schedules">Schedules</a>
            <a href="#about">About Us</a>
            <Link to="/login" className="nav-login">Login</Link>
          </nav>
        </div>

        <div className="hero-brand-slot hero-brand-slot-right" aria-hidden="true">
          {sealUrl ? (
            <img src={sealUrl} alt="LGU seal" className="hero-brand-image" />
          ) : (
            <div className="hero-brand-placeholder">Seal</div>
          )}
        </div>

        <div className="hero-contact-card">
          <p className="contact-label">Official Contact</p>
          <h3>{data.branding?.officeName || `${data.lguName} Legislative Office`}</h3>
          <p>{data.branding?.address}</p>
          <p>{data.branding?.phone}</p>
          <p>{data.branding?.email}</p>
          <p>{data.branding?.officeHours}</p>
        </div>

      </header>

      <section className="stats-grid" aria-label="overview statistics">
        {stats.map((item) => (
          <article key={item.label} className="stat-card">
            <p>{item.label}</p>
            <h3>{item.value}</h3>
          </article>
        ))}
      </section>

      {loading && <p className="page-note">Loading public information...</p>}
      {!loading && error && <p className="page-note warning">{error}</p>}

      <section className="visitor-tools" aria-label="public directory tools">
        <div className="tool-block search-tool search-tool-wide">
          <label htmlFor="public-global-search">Search the whole page</label>
          <input
            id="public-global-search"
            type="search"
            placeholder="Search councilors, documents, committees, sessions, and meetings"
            value={globalQuery}
            onChange={(event) => setGlobalQuery(event.target.value)}
          />
        </div>

        <div className="tool-block spotlight-tool">
          <p className="spotlight-label">Next public session</p>
          <h3>{nextSession?.title || 'No scheduled session yet'}</h3>
          <p>
            {nextSession
              ? `${formatDate(nextSession.date)} at ${formatTime(nextSession.session_time)}`
              : 'Schedules will appear here once published.'}
          </p>
        </div>

        <div className="tool-block spotlight-tool">
          <p className="spotlight-label">Next committee meeting</p>
          <h3>{nextMeeting?.title || 'No scheduled committee meeting yet'}</h3>
          <p>
            {nextMeeting
              ? `${formatDate(nextMeeting.meeting_date)} at ${formatTime(nextMeeting.meeting_time)}`
              : 'Upcoming committee meetings will appear here.'}
          </p>
        </div>
      </section>

      <main className="public-content">
        <section id="councilors" className="content-section">
          <div className="section-title-row">
            <h2>Councilors Information</h2>
            <span className="section-count">{filteredCouncilors.length}</span>
          </div>
          <div className="card-grid">
            {filteredCouncilors.length > 0 ? (
              filteredCouncilors.map((member) => (
                <article key={member.id} className="info-card">
                  <div className="councilor-card-header">
                    {member.photo_url ? (
                      <>
                        <img
                          src={resolveAssetUrl(member.photo_url)}
                          alt={`${member.name} profile`}
                          className="councilor-photo"
                          onError={(event) => {
                            event.currentTarget.hidden = true;
                            const fallback = event.currentTarget.nextElementSibling;
                            if (fallback) {
                              fallback.hidden = false;
                            }
                          }}
                        />
                        <div className="councilor-photo-placeholder" hidden>{getInitials(member.name)}</div>
                      </>
                    ) : (
                      <div className="councilor-photo-placeholder">{getInitials(member.name)}</div>
                    )}
                    <div>
                      <h3>{member.name}</h3>
                      <p>{member.role}</p>
                    </div>
                  </div>
                  <Link to={`/visit/councilors/${member.id}`} className="detail-link">View full details</Link>
                </article>
              ))
            ) : (
              <p className="empty-text">No councilor records match the current search.</p>
            )}
          </div>
        </section>

        <section id="documents" className="content-section">
          <div className="section-title-row">
            <h2>Legislative Documents</h2>
            <span className="section-count">{filteredDocuments.length}</span>
          </div>
          <div className="list-cards">
            {filteredDocuments.length > 0 ? (
              filteredDocuments.map((doc) => (
                <article key={`${doc.document_type}-${doc.id}`} className="list-card-item">
                  <p className="list-chip">{doc.document_type}</p>
                  <h3>{doc.title || 'Untitled document'}</h3>
                  <p>
                    {doc.reference_no || 'No document number'} | {doc.status || 'No status'}
                  </p>
                  <p>Stage: {doc.reading_stage || 'Not specified'}</p>
                  <p>Last updated: {formatDate(doc.updated_at)}</p>
                  <Link
                    to={`/visit/documents/${String(doc.document_type || '').toLowerCase()}-${doc.id}`}
                    className="detail-link"
                  >
                    View full details
                  </Link>
                </article>
              ))
            ) : (
              <p className="empty-text">No legislative documents match the current search.</p>
            )}
          </div>
        </section>

        <section id="committees" className="content-section">
          <div className="section-title-row">
            <h2>Committees</h2>
            <span className="section-count">{filteredCommittees.length}</span>
          </div>
          <div className="list-cards">
            {filteredCommittees.length > 0 ? (
              filteredCommittees.map((committee) => (
                <article key={committee.id} className="list-card-item">
                  <h3>{committee.name}</h3>
                  <p>{committee.description || 'No committee description yet.'}</p>
                  <p>
                    Chair: {committee.chair_name || 'Unassigned'} | Members: {committee.member_count || 0}
                  </p>
                  <p>Status: {committee.status || 'Not specified'}</p>
                  <Link to={`/visit/committees/${committee.id}`} className="detail-link">View full details</Link>
                </article>
              ))
            ) : (
              <p className="empty-text">No committee information matches the current search.</p>
            )}
          </div>
        </section>

        <section id="schedules" className="content-section two-column">
          <div>
            <div className="section-title-row">
              <h2>Scheduled Sessions</h2>
            </div>
            <div className="list-cards compact">
              {filteredSessions.length > 0 ? (
                filteredSessions.map((session) => (
                  <article key={session.id} className="list-card-item">
                    <h3>{session.title}</h3>
                    <p>
                      {formatDate(session.date)} at {formatTime(session.session_time)}
                    </p>
                    <p>{session.location || 'Location to be announced'}</p>
                  </article>
                ))
              ) : (
                <p className="empty-text">No upcoming sessions yet.</p>
              )}
            </div>
          </div>

          <div>
            <div className="section-title-row">
              <h2>Scheduled Committee Meetings</h2>
            </div>
            <div className="list-cards compact">
              {filteredMeetings.length > 0 ? (
                filteredMeetings.map((meeting) => (
                  <article key={meeting.id} className="list-card-item">
                    <h3>{meeting.title}</h3>
                    <p>
                      {formatDate(meeting.meeting_date)} at {formatTime(meeting.meeting_time)}
                    </p>
                    <p>{meeting.committee_name || 'Committee'} | {meeting.meeting_location || 'Location TBA'}</p>
                  </article>
                ))
              ) : (
                <p className="empty-text">No upcoming committee meetings yet.</p>
              )}
            </div>
          </div>
        </section>

        <section id="about" className="content-section about-section">
          <div className="section-title-row">
            <h2>About Us</h2>
          </div>
          <div className="about-grid">
            <div>
              <p>{data.about}</p>
              <p>
                This public page is intended for residents, partner agencies, and visitors who need a quick view of
                legislative activity without accessing internal tools.
              </p>
            </div>

            <aside className="contact-card">
              <p className="contact-label">Public Contact</p>
              <h3>{data.branding?.officeName || `${data.lguName} Legislative Office`}</h3>
              <p>{data.branding?.address}</p>
              <p>{data.branding?.phone}</p>
              <p>{data.branding?.email}</p>
              <p>Office hours: {data.branding?.officeHours}</p>
              <p>For official records and staff access, proceed through the secure login page.</p>
              <Link to="/login" className="primary-cta">Proceed to Login</Link>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
