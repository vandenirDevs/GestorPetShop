import { API_BASE_URL } from './utils.js';
import { notify } from './utils.js';

const TOKEN_KEY = 'petshop_token';
const USER_KEY = 'petshop_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.__permissionsLoaded = false;
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return !!getToken();
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.clear();
  window.__permissionsLoaded = false;
}

export async function login(email, senha) {
  const response = await fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.mensagem || payload?.message || 'Não foi possível fazer login.');
  }

  const token = payload.token || payload.access_token || payload.jwt;
  if (!token) {
    throw new Error('Token não retornado pela API.');
  }

  const user = {
    id: payload.usuario?.id || payload.id,
    nome: payload.usuario?.nome || payload.nome,
    email: payload.usuario?.email || payload.email,
    perfil: payload.usuario?.perfil || payload.perfil
  };

  saveSession(token, user);
  return { token, user };
}

export function logout({ redirectToLogin = true } = {}) {
  clearSession();
  const permissionModule = import('./permissions.js').catch(() => null);
  permissionModule.then((module) => module?.clearPermissions?.());
  notify('info', 'Sessão encerrada.');
  if (redirectToLogin) {
    window.location.hash = '#/login';
  }
}
