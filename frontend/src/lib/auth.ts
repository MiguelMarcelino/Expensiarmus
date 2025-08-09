import { writable } from 'svelte/store';
import { api } from './api';

export type User = { id: string; username: string };

export const currentUser = writable<User | null>(null);
export const authReady = writable(false);

export function loadFromStorage() {
  const user = localStorage.getItem('user');
  if (user) currentUser.set(JSON.parse(user));
  authReady.set(true);
}

export async function login(username: string, password: string) {
  const { token, user } = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  currentUser.set(user);
}

export async function register(username: string, password: string) {
  const { token, user } = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  currentUser.set(user);
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser.set(null);
  if (typeof window !== 'undefined') {
    window.location.hash = '#/';
  }
}
