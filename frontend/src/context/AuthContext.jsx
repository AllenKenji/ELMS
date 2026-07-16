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

function readStoredUser() {
  try {
    const storedUser = sessionStorage.getItem('authUser');
    if (!storedUser) return null;
    return JSON.parse(storedUser);
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
    const storedUser = readStoredUser();
    if (storedUser) return storedUser;

    const storedAccessToken = sessionStorage.getItem('accessToken');
    return decodeValidUser(storedAccessToken);
  });

  const updateUser = (nextUserOrUpdater) => {
    setUser((currentUser) => {
      const nextUser = typeof nextUserOrUpdater === 'function'
        ? nextUserOrUpdater(currentUser)
        : nextUserOrUpdater;

      if (nextUser) {
        sessionStorage.setItem('authUser', JSON.stringify(nextUser));
      } else {
        sessionStorage.removeItem('authUser');
      }

      return nextUser;
    });
  };

  const login = (tokens) => {
    sessionStorage.setItem('accessToken', tokens.accessToken);
    sessionStorage.setItem('refreshToken', tokens.refreshToken);
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    if (tokens.user) {
      updateUser(tokens.user);
      return;
    }

    try {
      const decodedUser = jwtDecode(tokens.accessToken);
      updateUser(decodedUser);
    } catch {
      updateUser(null);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('authUser');
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  useEffect(() => {
    if (!accessToken || !user?.id) return;

    let cancelled = false;

    const syncCurrentUserPhoto = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/users/me/photo`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (cancelled) return;

        const nextPhotoUrl = res.data?.photo_url || null;
        updateUser((currentUser) => {
          if (!currentUser) return currentUser;
          if ((currentUser.photo_url || null) === nextPhotoUrl) {
            return currentUser;
          }
          return {
            ...currentUser,
            photo_url: nextPhotoUrl,
          };
        });
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to sync current user photo:', err);
      }
    };

    syncCurrentUserPhoto();

    const handleWindowFocus = () => {
      syncCurrentUserPhoto();
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [accessToken, user?.id]);

  // 🔄 Refresh access token automatically
  useEffect(() => {
    if (!refreshToken) return;

    const refreshAccessToken = async () => {
      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });
        const { accessToken: newAccessToken } = res.data;
        const refreshedUser = res.data?.user || null;

        if (newAccessToken) {
          sessionStorage.setItem('accessToken', newAccessToken);
          setAccessToken(newAccessToken);
          if (refreshedUser) {
            updateUser(refreshedUser);
          } else {
            try {
              const decodedUser = jwtDecode(newAccessToken);
              updateUser(decodedUser);
            } catch {
              updateUser(null);
            }
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
    <Auth.Provider value={{ accessToken, refreshToken, setAccessToken, setRefreshToken, user, updateUser, login, logout }}>
      {children}
    </Auth.Provider>
  );
}
