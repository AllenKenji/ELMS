import '../../styles/MessageThread.css';

export default function MessageThread({ message, onClose, onDelete, onReply }) {
  

  return (
    <div className="message-thread-modal">
      <div className="modal-overlay" onClick={onClose}></div>

      <div className="modal-content">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>{message.subject}</h2>
            <p className="thread-meta">
              {new Date(message.created_at).toLocaleString()}
            </p>
          </div>
          <button
            className="btn-close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Message Body */}
        <div className="modal-body">
          <div className="message-details">
            <div className="detail-row">
              <label>From:</label>
              <span>{message.sender_name}</span>
            </div>
            <div className="detail-row">
              <label>To:</label>
              <span>{message.receiver_name}</span>
            </div>
            <div className="detail-row">
              <label>Date:</label>
              <span>{new Date(message.created_at).toLocaleString()}</span>
            </div>
          </div>

          <div className="message-body-content">
            {message.body}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-secondary" onClick={onReply}>
            📧 Reply
          </button>
          <button className="btn btn-danger" onClick={onDelete}>
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>
  );
}