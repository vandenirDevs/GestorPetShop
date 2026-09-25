import { API_BASE_URL } from './utils.js';
import { getToken, logout } from './auth.js';
import { notify } from './utils.js';

export async function request(endpoint, options = {}) {
  const { method = 'GET', body, headers = {}, query = {}, customError = false } = options;
  const token = getToken();

  const requestHeaders = {
    ...headers,
    ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' })
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const url = new URL(`${API_BASE_URL}${endpoint}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? (typeof body === 'string' || body instanceof FormData ? body : JSON.stringify(body)) : undefined
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const message = payload && (payload.mensagem || payload.message) ? (payload.mensagem || payload.message) : 'Erro ao comunicar com a API.';

    if (response.status === 401) {
      if (window.location.hash !== '#/login') {
        logout();
        notify('warning', 'Sua sessão expirou. Faça login novamente.');
      }
      if (!customError && window.location.hash !== '#/login') {
        window.location.hash = '#/login';
      }
    }

    if (response.status === 403) {
      notify('warning', message || 'Acesso negado.');
    }

    if (response.status >= 400 && response.status < 500 && !customError && response.status !== 401 && response.status !== 403) {
      notify('error', message);
    }

    throw {
      status: response.status,
      message,
      data: payload
    };
  }

  return payload;
}

export const api = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
  patch: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' })
};

export function getFriendlyError(error) {
  const message = error && error.message ? error.message : 'Erro inesperado.';
  return message;
}
