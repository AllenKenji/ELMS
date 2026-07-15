import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBeforeUnload, useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/useAuth';
import LiveSessionPanel from '../components/Sessions/LiveSessionPanel';
import LocalMeetingRecorder from '../components/common/LocalMeetingRecorder';
import '../styles/SessionDetails.css';

function canBroadcastMeeting(user, committee) {
  if (!user || !committee) return false;

  const normalizedUserRole = String(user.role || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, ' ');

  if (['admin', 'vice mayor', 'secretary', 'committee secretary'].includes(normalizedUserRole)) return true;
  if (String(committee.chair_id) === String(user.id)) return true;

  return Array.isArray(committee.members) && committee.members.some(
    (member) => {
      const normalizedMemberRole = String(member.role || '')
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, ' ');

      return (
        String(member.user_id) === String(user.id) &&
        ['chair', 'vice chair', 'secretary', 'committee secretary'].includes(normalizedMemberRole)
      );
    }
  );
}

export default function CommitteeMeetingLiveRoomPage() {
  const { committeeId, meetingId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [committee, setCommittee] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [liveBroadcastStream, setLiveBroadcastStream] = useState(null);
  const [isLocalRecordingActive, setIsLocalRecordingActive] = useState(false);
  const [isBroadcastingLive, setIsBroadcastingLive] = useState(false);

  const watchMode = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    return params.get('watch') === '1';
  }, [location.search]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const [committeeRes, meetingsRes] = await Promise.all([
          api.get(`/committees/${committeeId}`),
          api.get(`/committees/${committeeId}/meetings`),
        ]);

        const allMeetings = meetingsRes.data || [];
        const found = allMeetings.find((item) => String(item.id) === String(meetingId));

        if (!found) {
          setError('Meeting not found or inaccessible.');
          setMeeting(null);
        } else {
          setMeeting(found);
        }

        setCommittee(committeeRes.data || null);
      } catch (err) {
        setError(err?.message || 'Failed to load live room.');
      } finally {
        setLoading(false);
      }
    };

    if (committeeId && meetingId) {
      load();
    }
  }, [committeeId, meetingId]);

  const canBroadcast = useMemo(() => {
    if (watchMode) return false;
    return canBroadcastMeeting(user, committee);
  }, [watchMode, user, committee]);

  const viewerTabUrl = useMemo(() => {
    const path = `/dashboard/committee-meetings/live/${committeeId}/${meetingId}`;
    return `${path}?watch=1`;
  }, [committeeId, meetingId]);

  const hostTabUrl = useMemo(() => {
    return `/dashboard/committee-meetings/live/${committeeId}/${meetingId}`;
  }, [committeeId, meetingId]);

  const shouldBlockNavigation = !watchMode && (isBroadcastingLive || isLocalRecordingActive);

  const blocker = useBlocker(
    shouldBlockNavigation
      ? ({ currentLocation, nextLocation }) => (
          currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search
        )
      : false
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      return;
    }

    const confirmed = window.confirm(
      'Leaving this page will stop the active live session or recording. Continue?'
    );

    if (confirmed) {
      blocker.proceed();
      return;
    }

    blocker.reset();
  }, [blocker]);

  useBeforeUnload(
    useCallback((event) => {
      if (!shouldBlockNavigation) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    }, [shouldBlockNavigation])
  );

  if (loading) {
    return (
      <div className="session-details-page" style={{ padding: '1.5rem' }}>
        <p>Loading meeting live room...</p>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="session-details-page" style={{ padding: '1.5rem' }}>
        <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
          Back
        </button>
        <p style={{ marginTop: '1rem', color: '#c0392b' }}>{error || 'Meeting not available.'}</p>
      </div>
    );
  }

  return (
    <div className="session-details-page" style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Committee Live Room</h2>
          <p style={{ margin: '0.25rem 0 0 0', color: '#666' }}>{meeting.title}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {!watchMode && canBroadcast && !meeting.ended && (
            <a className="btn btn-secondary" href={viewerTabUrl} target="_blank">
              Open Viewer Tab
            </a>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </div>

      {watchMode && (
        <div style={{ margin: '-0.5rem 0 1rem 0', color: '#666', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <p style={{ margin: 0 }}>Viewer Mode enabled for same-browser testing.</p>
          {canBroadcastMeeting(user, committee) && (
            <a className="btn btn-secondary" href={hostTabUrl}>
              Switch to Host Mode
            </a>
          )}
        </div>
      )}

      {meeting.ended && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <span>⚠️</span>
          <p>This meeting has already ended. Live broadcasting is unavailable.</p>
        </div>
      )}

      <LiveSessionPanel
        sessionId={Number(meetingId)}
        canBroadcast={!meeting.ended && canBroadcast}
        broadcastStream={liveBroadcastStream}
        hostName={user?.name || user?.email || 'Host'}
        hostRole={user?.role || ''}
        onBroadcastStateChange={setIsBroadcastingLive}
      />

      {!meeting.ended && canBroadcast && (
        <section className="detail-section full-width" style={{ marginTop: '1rem' }}>
          <h3>Committee Recording</h3>
          <p className="session-recording-hint" style={{ marginBottom: '0.75rem' }}>
            Start local recording here to capture and upload the committee meeting. While recording, this stream is also used for live broadcast preview.
          </p>
          <LocalMeetingRecorder
            meetingTitle={meeting.title}
            committeeId={meeting.committee_id}
            meetingId={meeting.id}
            recordingUrl={meeting.recording_url}
            recordingUploadedAt={meeting.recording_uploaded_at}
            recordingUploadedByName={meeting.recording_uploaded_by_name}
            onCaptureStarted={setLiveBroadcastStream}
            onCaptureStopped={() => setLiveBroadcastStream(null)}
            onRecordingStateChange={setIsLocalRecordingActive}
            onUploadComplete={async () => {
              try {
                const meetingsRes = await api.get(`/committees/${committeeId}/meetings`);
                const allMeetings = meetingsRes.data || [];
                const found = allMeetings.find((item) => String(item.id) === String(meetingId));
                if (found) {
                  setMeeting(found);
                }
              } catch {
                // keep current meeting data if refresh fails
              }
            }}
          />
          {isLocalRecordingActive && (
            <p style={{ marginTop: '0.6rem', color: '#2c5f76', fontWeight: 600 }}>
              Recording is active. Keep this tab open until Stop and Save completes.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
