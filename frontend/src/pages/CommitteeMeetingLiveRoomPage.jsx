import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/useAuth';
import LiveSessionPanel from '../components/Sessions/LiveSessionPanel';
import '../styles/SessionDetails.css';

function canBroadcastMeeting(user, committee) {
  if (!user || !committee) return false;
  if (['Admin', 'Vice Mayor'].includes(user.role)) return true;
  if (String(committee.chair_id) === String(user.id)) return true;
  return Array.isArray(committee.members) && committee.members.some(
    (member) => String(member.user_id) === String(user.id) && ['Chair', 'Secretary', 'Committee Secretary'].includes(member.role)
  );
}

export default function CommitteeMeetingLiveRoomPage() {
  const { committeeId, meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [committee, setCommittee] = useState(null);
  const [meeting, setMeeting] = useState(null);

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

  const canBroadcast = useMemo(() => canBroadcastMeeting(user, committee), [user, committee]);

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
        <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>

      {meeting.ended && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <span>⚠️</span>
          <p>This meeting has already ended. Live broadcasting is unavailable.</p>
        </div>
      )}

      <LiveSessionPanel
        sessionId={Number(meetingId)}
        canBroadcast={!meeting.ended && canBroadcast}
        hostName={user?.name || user?.email || 'Host'}
        hostRole={user?.role || ''}
      />
    </div>
  );
}
