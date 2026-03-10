import React, { useState } from 'react';

export default function MessageList() {
  const [messages] = useState([
    { id: 1, sender: "Secretary", subject: "Meeting Reminder", body: "Don't forget the session tomorrow at 9 AM." },
    { id: 2, sender: "Captain", subject: "Community Update", body: "Barangay clean-up scheduled this weekend." },
    { id: 3, sender: "Resident", subject: "Request", body: "Can we get a copy of the latest ordinance?" },
  ]);

  return (
    <div>
      <h2>Messages</h2>
      <ul>
        {messages.map(msg => (
          <li key={msg.id}>
            <h3>{msg.subject}</h3>
            <p><strong>From:</strong> {msg.sender}</p>
            <p>{msg.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
