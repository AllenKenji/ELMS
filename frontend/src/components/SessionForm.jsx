// components/SessionForm.jsx
import { useState } from 'react';
import "../styles/form.css";

export default function SessionForm({ onSubmit }) {
  const [date, setDate] = useState('');
  const [agenda, setAgenda] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ date, agenda });
    setDate('');
    setAgenda('');
  };

  return (
    <form onSubmit={handleSubmit} className="form-container">
      <h3>Schedule Session</h3>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />
      <textarea
        placeholder="Agenda"
        value={agenda}
        onChange={(e) => setAgenda(e.target.value)}
        required
      />
      <button type="submit">Schedule</button>
    </form>
  );
}
