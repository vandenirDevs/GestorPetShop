import { api } from './api.js';

let permissionsCache = null;

export async function loadPermissions() {
  try {
    const data = await api.get('/api/permissoes');
    const rows = data.permissoes || [];
    permissionsCache = {};
    rows.forEach((perm) => {
      permissionsCache[perm.modulo] = {
        visualizar: !!perm.visualizar,
        criar: !!perm.criar,
        editar: !!perm.editar,
        excluir: !!perm.excluir
      };
    });
    return permissionsCache;
  } catch (error) {
    permissionsCache = {};
    throw error;
  }
}

export function getPermissions() {
  return permissionsCache || {};
}

export function hasPermission(modulo, acao) {
  if (!modulo || !acao) return true;
  const perms = getPermissions();
  const mod = perms[modulo] || {};
  return !!mod[acao];
}

export function canAccessMenu(moduleName) {
  return hasPermission(moduleName, 'visualizar') || moduleName === 'dashboard';
}

export function clearPermissions() {
  permissionsCache = null;
}
