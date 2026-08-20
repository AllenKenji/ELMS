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

  return (
    <div className="public-lgu-page">
      <header className="public-header">
        <div className="brand-block">
          <p className="eyebrow">Official Public Portal</p>
          <h1>{data.lguName} Legislative Council</h1>
          <p className="lead-text">A public window into your local legislative work and schedules.</p>
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

      <main className="public-content">
        <section id="councilors" className="content-section">
          <div className="section-title-row">
            <h2>Councilors Information</h2>
          </div>
          <div className="card-grid">
            {data.councilors.length > 0 ? (
              data.councilors.map((member) => (
                <article key={member.id} className="info-card">
                  <h3>{member.name}</h3>
                  <p>{member.role}</p>
                </article>
              ))
            ) : (
              <p className="empty-text">No public councilor records available yet.</p>
            )}
          </div>
        </section>

        <section id="documents" className="content-section">
          <div className="section-title-row">
            <h2>Legislative Documents</h2>
          </div>
          <div className="list-cards">
            {data.legislativeDocuments.length > 0 ? (
              data.legislativeDocuments.map((doc) => (
                <article key={`${doc.document_type}-${doc.id}`} className="list-card-item">
                  <p className="list-chip">{doc.document_type}</p>
                  <h3>{doc.title || 'Untitled document'}</h3>
                  <p>
                    {doc.reference_no || 'No document number'} | {doc.status || 'No status'}
                  </p>
                  <p>Last updated: {formatDate(doc.updated_at)}</p>
                </article>
              ))
            ) : (
              <p className="empty-text">No legislative documents are currently available for public viewing.</p>
            )}
          </div>
        </section>

        <section id="committees" className="content-section">
          <div className="section-title-row">
            <h2>Committees</h2>
          </div>
          <div className="list-cards">
            {data.committees.length > 0 ? (
              data.committees.map((committee) => (
                <article key={committee.id} className="list-card-item">
                  <h3>{committee.name}</h3>
                  <p>{committee.description || 'No committee description yet.'}</p>
                  <p>
                    Chair: {committee.chair_name || 'Unassigned'} | Members: {committee.member_count || 0}
                  </p>
                </article>
              ))
            ) : (
              <p className="empty-text">No committee information is currently available.</p>
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
          <h2>About Us</h2>
          <p>{data.about}</p>
          <Link to="/login" className="primary-cta">Proceed to Login</Link>
        </section>
      </main>
    </div>
  );
}
