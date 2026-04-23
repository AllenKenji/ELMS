// context/AuthContext.jsx
import { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { Auth } from './auth';
import { API_BASE_URL } from '../api/api';

function decodeValidUser(token) {
  if (!token) return null;

  try {
    const decoded = jwtDecode(token);
    const now = Math.floor(Date.now() / 1000);
    if (decoded?.exp && decoded.exp <= now) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => {
    const storedAccessToken = sessionStorage.getItem('accessToken');
    if (!storedAccessToken) return null;

    const userFromToken = decodeValidUser(storedAccessToken);
    if (userFromToken) {
      return storedAccessToken;
    }

    console.warn('Invalid or expired access token found in storage. Clearing auth state.');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');

    return null;
  });
  const [refreshToken, setRefreshToken] = useState(sessionStorage.getItem('refreshToken'));
  const [user, setUser] = useState(() => {
    const storedAccessToken = sessionStorage.getItem('accessToken');
    return decodeValidUser(storedAccessToken);
  });

  const login = (tokens) => {
    sessionStorage.setItem('accessToken', tokens.accessToken);
    sessionStorage.setItem('refreshToken', tokens.refreshToken);
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    if (tokens.user) {
      setUser(tokens.user);
      return;
    }

    try {
      setUser(jwtDecode(tokens.accessToken));
    } catch {
      setUser(null);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  // 🔄 Refresh access token automatically
  useEffect(() => {
    if (!refreshToken) return;

    const refreshAccessToken = async () => {
      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });
        const { accessToken: newAccessToken } = res.data;

        if (newAccessToken) {
          sessionStorage.setItem('accessToken', newAccessToken);
          setAccessToken(newAccessToken);
          try {
            setUser(jwtDecode(newAccessToken));
          } catch {
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Failed to refresh token:', err);
        logout();
      }
    };

    const currentToken = sessionStorage.getItem('accessToken');
    if (!currentToken) {
      refreshAccessToken();
    } else {
      try {
        const decoded = jwtDecode(currentToken);
        const now = Math.floor(Date.now() / 1000);
        if (decoded?.exp && decoded.exp <= now) {
          refreshAccessToken();
        }
      } catch {
        refreshAccessToken();
      }
    }

    const interval = setInterval(async () => {
      await refreshAccessToken();
    }, 14 * 60 * 1000); // refresh every 14 minutes (before 15m expiry)

    return () => clearInterval(interval);
  }, [refreshToken]);

  return (
    <Auth.Provider value={{ accessToken, refreshToken, setAccessToken, setRefreshToken, user, login, logout }}>
      {children}
    </Auth.Provider>
  );
}
