// context/useAuth.js
import { useContext } from 'react';
import { Auth } from './auth';

export function useAuth() {
  return useContext(Auth);
}
