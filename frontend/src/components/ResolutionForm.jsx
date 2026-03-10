// components/ResolutionForm.jsx
import { useState } from 'react';
import "../styles/form.css";

export default function ResolutionForm({ onSubmit }) {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ title, details });
    setTitle('');
    setDetails('');
  };

  return (
    <form onSubmit={handleSubmit} className="form-container">
      <h3>Submit Resolution</h3>
      <input
        type="text"
        placeholder="Resolution Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        placeholder="Details"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        required
      />
      <button type="submit">Submit</button>
    </form>
  );
}
