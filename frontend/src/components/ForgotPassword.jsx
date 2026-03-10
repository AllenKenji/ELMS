import React, { useState } from 'react';
import axios from 'axios';
import "../styles/ForgotPassword.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:5000/auth/forgot-password', {
        email,
      });

      setMessage(res.data.message || "Password reset link sent to your email.");
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        (err.request ? 'Server unreachable' : 'Unexpected error');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-container">
      <h2>Forgot Password</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Enter your email:</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
    </div>
  );
}
