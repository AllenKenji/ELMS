import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import '../../styles/OrdinanceWorkflow.css';

const WORKFLOW_STAGES = [
  {
    id: 1,
    name: 'Draft',
    description: 'Ordinance is being prepared',
    icon: '✏️',
    requiredRole: 'Proposer',
    nextAction: 'Submit for Review',
  },
  {
    id: 2,
    name: 'Submitted',
    description: 'Awaiting secretary review',
    icon: '📤',
    requiredRole: 'Secretary',
    nextAction: 'Start Review',
  },
  {
    id: 3,
    name: 'Under Review',
    description: 'Being reviewed by committee',
    icon: '👀',
    requiredRole: 'Committee',
    nextAction: 'Complete Review',
  },
  {
    id: 4,
    name: 'Approved',
    description: 'Ready for council voting',
    icon: '✅',
    requiredRole: 'Council',
    nextAction: 'Schedule Voting',
  },
  {
    id: 5,
    name: 'Published',
    description: 'Ordinance is now law',
    icon: '📖',
    requiredRole: 'Admin',
    nextAction: 'Completed',
  },
];

export default function OrdinanceWorkflow({ ordinanceId, ordinance, onStatusUpdate }) {
  const { user } = useAuth();
  const [workflow, setWorkflow] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionComment, setActionComment] = useState('');
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(''); // submit, approve, reject, etc

  // Wrap fetchWorkflowData with useCallback to prevent dependency issues
  const fetchWorkflowData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [workflowRes, approvalsRes] = await Promise.all([
        api.get(`/ordinances/${ordinanceId}/workflow`),
        api.get(`/ordinances/${ordinanceId}/approvals`),
      ]);

      setWorkflow(workflowRes.data);
      setApprovals(approvalsRes.data || []);
    } catch (err) {
      setError('Failed to load workflow data.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [ordinanceId]);

  useEffect(() => {
    fetchWorkflowData();
  }, [fetchWorkflowData]);

  const canPerformAction = (action) => {
    const rolePermissions = {
      'submit': ['Secretary', 'Councilor'],
      'approve': ['Secretary', 'Admin'],
      'reject': ['Secretary', 'Admin'],
      'publish': ['Admin'],
      'archive': ['Admin'],
      'request_changes': ['Secretary', 'Admin'],
    };

    return rolePermissions[action]?.includes(user?.role);
  };

  const handleActionClick = (action) => {
    if (!canPerformAction(action)) {
      setError('You do not have permission to perform this action.');
      return;
    }

    setActionType(action);
    setShowActionModal(true);
  };

  const submitAction = async () => {
    if (!actionType) return;

    try {
      const payload = {
        action: actionType,
        ordinance_id: ordinanceId,
        performed_by_id: user?.id,
        performed_by_name: user?.name,
        comment: actionComment,
      };

      const response = await api.post(
        `/ordinances/${ordinanceId}/workflow-action`,
        payload
      );

      setWorkflow(response.data.workflow);
      setApprovals(response.data.approvals);
      setShowActionModal(false);
      setActionComment('');
      setActionType('');

      onStatusUpdate?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to perform action.');
      console.error('Error:', err);
    }
  };

  const getCurrentStageIndex = () => {
    return WORKFLOW_STAGES.findIndex(stage => stage.name === ordinance?.status);
  };

  const currentStageIndex = getCurrentStageIndex();
  const currentStage = WORKFLOW_STAGES[currentStageIndex] || WORKFLOW_STAGES[0];

  if (loading) {
    return (
      <div className="ordinance-workflow">
        <div className="loading">Loading workflow...</div>
      </div>
    );
  }

  return (
    <div className="ordinance-workflow">
      {error && (
        <div className="workflow-alert alert-error">
          <span>⚠️</span>
          <div>
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Workflow Progress */}
      <section className="workflow-section">
        <h3>📊 Workflow Progress</h3>
        <div className="progress-container">
          <div className="progress-bar">
            {WORKFLOW_STAGES.map((stage, index) => {
              const isCompleted = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;

              return (
                <div key={stage.id} className="progress-item">
                  <div
                    className={`progress-circle ${
                      isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'
                    }`}
                  >
                    {isCompleted ? '✓' : stage.icon}
                  </div>
                  <div className="progress-label">
                    <span className="stage-name">{stage.name}</span>
                    <span className="stage-desc">{stage.description}</span>
                  </div>
                  {index < WORKFLOW_STAGES.length - 1 && (
                    <div className={`progress-arrow ${isCompleted ? 'completed' : ''}`}>
                      →
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Current Stage Info */}
      <section className="workflow-section">
        <h3>📍 Current Stage</h3>
        <div className="current-stage-card">
          <div className="stage-header">
            <span className="stage-icon">{currentStage.icon}</span>
            <div className="stage-info">
              <h4>{currentStage.name}</h4>
              <p>{currentStage.description}</p>
            </div>
          </div>
          <div className="stage-details">
            <p>
              <strong>Required Role:</strong> {currentStage.requiredRole}
            </p>
            <p>
              <strong>Next Action:</strong> {currentStage.nextAction}
            </p>
          </div>
        </div>
      </section>

      {/* Approvals Status */}
      <section className="workflow-section">
        <h3>✔️ Approvals & Sign-offs</h3>
        {approvals && approvals.length > 0 ? (
          <div className="approvals-grid">
            {approvals.map((approval, index) => (
              <div key={index} className="approval-card">
                <div className="approval-header">
                  <span className={`approval-status ${approval.status.toLowerCase()}`}>
                    {approval.status === 'Approved'
                      ? '✓'
                      : approval.status === 'Rejected'
                      ? '✗'
                      : approval.status === 'Pending'
                      ? '⏳'
                      : '?'}
                  </span>
                  <div>
                    <h4>{approval.approver_role}</h4>
                    <span className={`status-label ${approval.status.toLowerCase()}`}>
                      {approval.status}
                    </span>
                  </div>
                </div>

                <div className="approval-body">
                  <p>
                    <strong>Approver:</strong>{' '}
                    {approval.approver_name || 'Awaiting assignment'}
                  </p>

                  {approval.approved_at && (
                    <p>
                      <strong>Date:</strong>{' '}
                      {new Date(approval.approved_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  )}

                  {approval.notes && (
                    <div className="approval-notes">
                      <strong>Notes:</strong>
                      <p>{approval.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-data">No approvals defined for this ordinance</p>
        )}
      </section>

      {/* Action History */}
      <section className="workflow-section">
        <h3>📝 Action History</h3>
        {workflow && workflow.actions && workflow.actions.length > 0 ? (
          <div className="actions-timeline">
            {workflow.actions.map((action, index) => (
              <div key={index} className="action-item">
                <div className="action-marker"></div>
                <div className="action-content">
                  <div className="action-header">
                    <span className="action-type">{action.action_type}</span>
                    <span className="action-date">
                      {new Date(action.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="action-performer">
                    Performed by: <strong>{action.performed_by_name}</strong>
                  </p>
                  {action.comment && (
                    <div className="action-comment">
                      <strong>Comment:</strong>
                      <p>{action.comment}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-data">No actions yet</p>
        )}
      </section>

      {/* Available Actions */}
      <section className="workflow-section">
        <h3>⚙️ Available Actions</h3>
        <div className="actions-grid">
          {ordinance?.status === 'Draft' && (
            <button
              onClick={() => handleActionClick('submit')}
              className="action-btn btn-submit"
              disabled={!canPerformAction('submit')}
            >
              📤 Submit for Review
            </button>
          )}

          {ordinance?.status === 'Submitted' && (
            <>
              <button
                onClick={() => handleActionClick('approve')}
                className="action-btn btn-approve"
                disabled={!canPerformAction('approve')}
              >
                ✅ Approve
              </button>
              <button
                onClick={() => handleActionClick('reject')}
                className="action-btn btn-reject"
                disabled={!canPerformAction('reject')}
              >
                ❌ Reject
              </button>
              <button
                onClick={() => handleActionClick('request_changes')}
                className="action-btn btn-changes"
                disabled={!canPerformAction('request_changes')}
              >
                🔄 Request Changes
              </button>
            </>
          )}

          {ordinance?.status === 'Under Review' && (
            <>
              <button
                onClick={() => handleActionClick('approve')}
                className="action-btn btn-approve"
                disabled={!canPerformAction('approve')}
              >
                ✅ Approve
              </button>
              <button
                onClick={() => handleActionClick('reject')}
                className="action-btn btn-reject"
                disabled={!canPerformAction('reject')}
              >
                ❌ Reject
              </button>
            </>
          )}

          {ordinance?.status === 'Approved' && (
            <button
              onClick={() => handleActionClick('publish')}
              className="action-btn btn-publish"
              disabled={!canPerformAction('publish')}
            >
              📖 Publish
            </button>
          )}

          {['Published', 'Approved', 'Under Review'].includes(ordinance?.status) && (
            <button
              onClick={() => handleActionClick('archive')}
              className="action-btn btn-archive"
              disabled={!canPerformAction('archive')}
            >
              🗂️ Archive
            </button>
          )}
        </div>

        {Object.entries({
          submit: 'Submit for Review',
          approve: 'Approve',
          reject: 'Reject',
          request_changes: 'Request Changes',
          publish: 'Publish',
          archive: 'Archive',
        }).every(([action]) => !canPerformAction(action)) && (
          <p className="no-permissions">
            You do not have permission to perform any actions on this ordinance.
          </p>
        )}
      </section>

      {/* Action Modal */}
      {showActionModal && (
        <div className="action-modal-overlay">
          <div className="action-modal">
            <h3>
              {actionType === 'submit' && '📤 Submit Ordinance for Review'}
              {actionType === 'approve' && '✅ Approve Ordinance'}
              {actionType === 'reject' && '❌ Reject Ordinance'}
              {actionType === 'request_changes' && '🔄 Request Changes'}
              {actionType === 'publish' && '📖 Publish Ordinance'}
              {actionType === 'archive' && '🗂️ Archive Ordinance'}
            </h3>

            <p className="action-description">
              {actionType === 'submit' &&
                'Submit this ordinance for review by the secretary.'}
              {actionType === 'approve' &&
                'Approve this ordinance. This will move it to the next stage.'}
              {actionType === 'reject' &&
                'Reject this ordinance. Please provide a reason for rejection.'}
              {actionType === 'request_changes' &&
                'Request changes to this ordinance. The proposer will need to revise it.'}
              {actionType === 'publish' &&
                'Publish this ordinance. It will become official law.'}
              {actionType === 'archive' &&
                'Archive this ordinance. It will no longer be active.'}
            </p>

            <div className="modal-form">
              <label htmlFor="actionComment">
                {['reject', 'request_changes'].includes(actionType)
                  ? 'Reason *'
                  : 'Notes (Optional)'}
              </label>
              <textarea
                id="actionComment"
                value={actionComment}
                onChange={e => setActionComment(e.target.value)}
                placeholder="Add any comments or notes..."
                rows="4"
                required={['reject', 'request_changes'].includes(actionType)}
              />
            </div>

            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowActionModal(false);
                  setActionComment('');
                  setActionType('');
                }}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                disabled={
                  ['reject', 'request_changes'].includes(actionType) &&
                  !actionComment.trim()
                }
                className={`btn-confirm btn-${actionType}`}
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}