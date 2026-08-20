import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api/api';
import '../styles/PublicLGUPage.css';

const fallbackData = {
  lguName: 'Local Government Unit',
  about:
    'This portal provides public visibility into council composition, legislative documents, committee structure, and official schedules.',
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

export default function PublicLGUPage() {
  const [data, setData] = useState(fallbackData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [documentFilter, setDocumentFilter] = useState('All');

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

  const normalizedQuery = directoryQuery.trim().toLowerCase();

  const filteredCouncilors = useMemo(() => {
    if (!normalizedQuery) return data.councilors;

    return data.councilors.filter((member) => {
      const haystack = `${member.name || ''} ${member.role || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [data.councilors, normalizedQuery]);

  const filteredCommittees = useMemo(() => {
    if (!normalizedQuery) return data.committees;

    return data.committees.filter((committee) => {
      const haystack = `${committee.name || ''} ${committee.description || ''} ${committee.chair_name || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [data.committees, normalizedQuery]);

  const filteredDocuments = useMemo(() => {
    return data.legislativeDocuments.filter((doc) => {
      const matchesType = documentFilter === 'All' || doc.document_type === documentFilter;
      const matchesQuery = !normalizedQuery || `${doc.title || ''} ${doc.reference_no || ''} ${doc.status || ''}`
        .toLowerCase()
        .includes(normalizedQuery);
      return matchesType && matchesQuery;
    });
  }, [data.legislativeDocuments, documentFilter, normalizedQuery]);

  const nextSession = data.scheduledSessions[0] || null;
  const nextMeeting = data.scheduledMeetings[0] || null;
  const documentTypes = ['All', 'Ordinance', 'Resolution'];

  return (
    <div className="public-lgu-page">
      <header className="public-header">
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
        <div className="tool-block search-tool">
          <label htmlFor="public-search">Search public directory</label>
          <input
            id="public-search"
            type="search"
            placeholder="Search councilors, committees, or documents"
            value={directoryQuery}
            onChange={(event) => setDirectoryQuery(event.target.value)}
          />
        </div>

        <div className="tool-block filter-tool">
          <label htmlFor="document-filter">Document type</label>
          <select
            id="document-filter"
            value={documentFilter}
            onChange={(event) => setDocumentFilter(event.target.value)}
          >
            {documentTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
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
                  <h3>{member.name}</h3>
                  <p>{member.role}</p>
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
                </article>
              ))
            ) : (
              <p className="empty-text">No legislative documents match the current filters.</p>
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
              {data.scheduledSessions.length > 0 ? (
                data.scheduledSessions.map((session) => (
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
              {data.scheduledMeetings.length > 0 ? (
                data.scheduledMeetings.map((meeting) => (
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
              <h3>{data.lguName} Legislative Office</h3>
              <p>Office hours: Monday to Friday, 8:00 AM to 5:00 PM</p>
              <p>For official records and staff access, proceed through the secure login page.</p>
              <Link to="/login" className="primary-cta">Proceed to Login</Link>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
