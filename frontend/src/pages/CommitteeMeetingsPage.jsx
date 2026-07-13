import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/useAuth';
import api from '../api/api';
import LocalMeetingRecorder from '../components/common/LocalMeetingRecorder';
import '../styles/CommitteeMeetingsPage.css';

function canAccessCommittee(user, committee) {
  if (!user || !committee) return false;
  if (['Admin', 'Vice Mayor'].includes(user.role)) return true;
  if (String(committee.chair_id) === String(user.id)) return true;
  return Array.isArray(committee.members) && committee.members.some(
    (member) => String(member.user_id) === String(user.id) && ['Chair', 'Secretary', 'Committee Secretary'].includes(member.role)
  );
}

function canCreateCommitteeMeeting(user, committee) {
  if (!user || !committee) return false;
  if (['Admin', 'Vice Mayor'].includes(user.role)) return true;
  if (String(committee.chair_id) === String(user.id)) return true;
  return Array.isArray(committee.members) && committee.members.some(
    (member) => String(member.user_id) === String(user.id) && member.role === 'Committee Secretary'
  );
}

function getDefaultMeetingForm() {
  return {
    title: '',
    meeting_date: '',
    meeting_time: '',
    meeting_mode: 'place',
    meeting_link: '',
    meeting_location: '',
  };
}

export default function CommitteeMeetingsPage() {
  const { user } = useAuth();
  const [committees, setCommittees] = useState([]);
  const [meetingsByCommittee, setMeetingsByCommittee] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCommittee, setActiveCommittee] = useState(null);
  const [createdMeeting, setCreatedMeeting] = useState(null);
  const [meetingSubmitting, setMeetingSubmitting] = useState(false);
  const [meetingError, setMeetingError] = useState('');
  const [form, setForm] = useState(getDefaultMeetingForm());

  const fetchMeetingsForCommittees = useCallback(async (committeeList) => {
    const accessibleCommittees = committeeList.filter((committee) => canAccessCommittee(user, committee));
    const results = await Promise.allSettled(
      accessibleCommittees.map(async (committee) => {
        const response = await api.get(`/committees/${committee.id}/meetings`);
        return { committeeId: committee.id, meetings: response.data || [] };
      })
    );

    const meetingMap = {};
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        meetingMap[result.value.committeeId] = result.value.meetings;
      }
    });

    setMeetingsByCommittee(meetingMap);
  }, [user]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get('/committees');
      const committeeList = response.data || [];

      const detailResults = await Promise.allSettled(
        committeeList.map((committee) => api.get(`/committees/${committee.id}`))
      );

      const committeeDetails = detailResults.map((result, index) => (
        result.status === 'fulfilled'
          ? result.value.data
          : committeeList[index]
      ));

      setCommittees(committeeDetails);
      await fetchMeetingsForCommittees(committeeDetails);
    } catch (err) {
      console.error('Error fetching committee meetings:', err);
      setError(err?.response?.data?.error || 'Failed to load committee meetings.');
      setCommittees([]);
      setMeetingsByCommittee({});
    } finally {
      setLoading(false);
    }
  }, [fetchMeetingsForCommittees]);

  useEffect(() => {
    if (!user?.id) return;
    fetchData();
  }, [fetchData, user?.id]);

  const visibleCommittees = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return committees
      .filter((committee) => canAccessCommittee(user, committee))
      .filter((committee) => {
        if (!term) return true;
        return [committee.name, committee.description, committee.chair_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
  }, [committees, searchTerm, user]);

  const openCreateModal = (committee) => {
    setActiveCommittee(committee);
    setCreatedMeeting(null);
    setForm(getDefaultMeetingForm());
    setMeetingError('');
  };

  const closeCreateModal = () => {
    setActiveCommittee(null);
    setCreatedMeeting(null);
    setForm(getDefaultMeetingForm());
    setMeetingError('');
  };

  const handleCreateMeeting = async () => {
    if (!activeCommittee) return;

    const meetingMode = form.meeting_mode || 'online';
    const meetingLink = String(form.meeting_link || '').trim();
    const meetingLocation = String(form.meeting_location || '').trim();

    if (!form.title.trim() || !form.meeting_date) {
      setMeetingError('Meeting title and date are required.');
      return;
    }

    if ((meetingMode === 'online' || meetingMode === 'both') && !meetingLink) {
      setMeetingError('Meeting link is required for online or hybrid meetings.');
      return;
    }

    if ((meetingMode === 'place' || meetingMode === 'both') && !meetingLocation) {
      setMeetingError('Meeting place is required for place or hybrid meetings.');
      return;
    }

    try {
      setMeetingSubmitting(true);
      setMeetingError('');

      const response = await api.post(`/committees/${activeCommittee.id}/meetings`, {
        title: form.title,
        meeting_date: form.meeting_date,
        meeting_time: form.meeting_time || '',
        meetingLink,
        meeting_mode: meetingMode,
        meeting_location: meetingLocation,
      });

      setCreatedMeeting(response.data || null);
      await fetchData();
    } catch (err) {
      console.error('Create committee meeting error:', err);
      setMeetingError(err?.response?.data?.error || 'Failed to create meeting.');
    } finally {
      setMeetingSubmitting(false);
    }
  };

  const handleRefreshCommittee = async (committeeId) => {
    try {
      const response = await api.get(`/committees/${committeeId}/meetings`);
      setMeetingsByCommittee((prev) => ({
        ...prev,
        [committeeId]: response.data || [],
      }));
    } catch (err) {
      console.error('Refresh committee meetings error:', err);
    }
  };

  return (
    <div className="committee-meetings-page">
      <div className="committee-meetings-header">
        <div>
          <p className="page-kicker">Committee Management</p>
          <h2>Committee Meetings</h2>
          <p className="page-subtitle">
            Create committee meetings, then record them locally in the same flow.
          </p>
        </div>
        <button className="btn-refresh" onClick={fetchData} type="button">
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      <div className="committee-meetings-toolbar">
        <input
          type="text"
          className="committee-meetings-search"
          placeholder="Search committees..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      {loading ? (
        <div className="committee-meetings-loading">Loading committee meetings...</div>
      ) : visibleCommittees.length === 0 ? (
        <div className="committee-meetings-empty">
          <h3>No committees found</h3>
          <p>There are no committee meetings available for your account.</p>
        </div>
      ) : (
        <div className="committee-meetings-grid">
          {visibleCommittees.map((committee) => {
            const meetings = meetingsByCommittee[committee.id] || [];
            const canCreate = canCreateCommitteeMeeting(user, committee);

            return (
              <section key={committee.id} className="committee-meeting-card">
                <div className="committee-meeting-card-header">
                  <div>
                    <h3>{committee.name}</h3>
                    <p>{committee.description || 'No description provided.'}</p>
                  </div>
                  <span className={`committee-status ${committee.status === 'Active' ? 'active' : 'inactive'}`}>
                    {committee.status}
                  </span>
                </div>

                <div className="committee-meeting-meta">
                  <span>Chair: {committee.chair_name || '—'}</span>
                  <span>{meetings.length} meeting(s)</span>
                </div>

                <div className="committee-meeting-actions">
                  {canCreate && (
                    <button className="btn-create-meeting" type="button" onClick={() => openCreateModal(committee)}>
                      + Create Meeting
                    </button>
                  )}
                  <button className="btn-link" type="button" onClick={() => handleRefreshCommittee(committee.id)}>
                    Refresh
                  </button>
                </div>

                {meetings.length > 0 ? (
                  <div className="committee-meetings-list">
                    {meetings.map((meeting) => (
                      <div key={meeting.id} className="committee-meeting-item">
                        <div className="committee-meeting-item-head">
                          <strong>{meeting.title}</strong>
                          <span className={`meeting-status ${meeting.ended ? 'ended' : 'open'}`}>
                            {meeting.ended ? 'Ended' : 'Open'}
                          </span>
                        </div>
                        <div className="committee-meeting-item-meta">
                          <span>📅 {meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString() : 'No date'}</span>
                          <span>🕒 {meeting.meeting_time || 'No time'}</span>
                        </div>
                        {meeting.recording_url ? (
                          <a href={meeting.recording_url.startsWith('http') ? meeting.recording_url : `${api.defaults.baseURL}${meeting.recording_url}`} target="_blank" rel="noreferrer">
                            Open recording
                          </a>
                        ) : (
                          <span className="no-recording">No recording yet</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="committee-meetings-none">No meetings scheduled yet.</p>
                )}
              </section>
            );
          })}
        </div>
      )}

      {activeCommittee && (
        <div className="committee-meeting-modal-overlay">
          <div className="committee-meeting-modal">
            <div className="committee-meeting-modal-header">
              <div>
                <p className="page-kicker">{activeCommittee.name}</p>
                <h3>{createdMeeting ? 'Record the meeting locally' : 'Create Committee Meeting'}</h3>
              </div>
              <button className="btn-close" type="button" onClick={closeCreateModal}>✕</button>
            </div>

            {createdMeeting ? (
              <div className="created-meeting-flow">
                <div className="created-meeting-banner">
                  <strong>{createdMeeting.title}</strong>
                  <p>
                    Meeting created. Record it locally now, then download or upload the saved copy from this same screen.
                  </p>
                </div>

                <LocalMeetingRecorder
                  meetingTitle={createdMeeting.title}
                  committeeId={createdMeeting.committee_id || activeCommittee.id}
                  meetingId={createdMeeting.id}
                  recordingUrl={createdMeeting.recording_url}
                  recordingUploadedAt={createdMeeting.recording_uploaded_at}
                  recordingUploadedByName={createdMeeting.recording_uploaded_by_name}
                  onUploadComplete={async () => {
                    await handleRefreshCommittee(activeCommittee.id);
                  }}
                />

                <div className="modal-actions">
                  <button className="btn-primary" type="button" onClick={closeCreateModal}>
                    Done
                  </button>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => {
                      setCreatedMeeting(null);
                      setForm(getDefaultMeetingForm());
                    }}
                  >
                    Create Another
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="form-grid">
                  <label>
                    Meeting Title *
                    <input type="text" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
                  </label>
                  <label>
                    Meeting Date *
                    <input type="date" value={form.meeting_date} onChange={(event) => setForm((prev) => ({ ...prev, meeting_date: event.target.value }))} />
                  </label>
                  <label>
                    Meeting Time
                    <input type="time" value={form.meeting_time} onChange={(event) => setForm((prev) => ({ ...prev, meeting_time: event.target.value }))} />
                  </label>
                  <label>
                    Mode
                    <select value={form.meeting_mode} onChange={(event) => setForm((prev) => ({ ...prev, meeting_mode: event.target.value }))}>
                      <option value="online">Online</option>
                      <option value="place">Local / In Person</option>
                      <option value="both">Both</option>
                    </select>
                  </label>
                  {(form.meeting_mode === 'online' || form.meeting_mode === 'both') && (
                    <label className="full-span">
                      Meeting Link *
                      <input type="url" value={form.meeting_link} onChange={(event) => setForm((prev) => ({ ...prev, meeting_link: event.target.value }))} placeholder="https://meet.google.com/..." />
                    </label>
                  )}
                  {(form.meeting_mode === 'place' || form.meeting_mode === 'both') && (
                    <label className="full-span">
                      Meeting Place *
                      <input type="text" value={form.meeting_location} onChange={(event) => setForm((prev) => ({ ...prev, meeting_location: event.target.value }))} placeholder="Committee Room A" />
                    </label>
                  )}
                </div>

                {meetingError && <div className="inline-error">{meetingError}</div>}

                <div className="modal-actions">
                  <button className="btn-primary" type="button" onClick={handleCreateMeeting} disabled={meetingSubmitting}>
                    {meetingSubmitting ? 'Creating...' : 'Create Meeting'}
                  </button>
                  <button className="btn-secondary" type="button" onClick={closeCreateModal} disabled={meetingSubmitting}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}