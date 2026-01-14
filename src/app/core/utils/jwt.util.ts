/**
 * Utilitário para decodificar e extrair informações de JWT
 * sem dependências externas (apenas conversão base64)
 */

export interface DecodedToken {
  sub?: string;
  email?: string;
  iat?: number;
  exp?: number;
  roles?: string[];
  userId?: string;
  memberOfOrgs?: string[];
  [key: string]: unknown;
}

/**
 * Decodifica um JWT e retorna o payload
 * @param token Token JWT para decodificar
 * @returns Objeto com as claims do token
 */
export function decodeJwt(token: string): DecodedToken | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('[JWT] Token inválido: não possui 3 partes');
      return null;
    }

    const decoded = atob(parts[1]); // Base64 decode
    return JSON.parse(decoded) as DecodedToken;
  } catch (error) {
    console.warn('[JWT] Erro ao decodificar token:', error);
    return null;
  }
}

/**
 * Extrai a data de expiração de um JWT
 * @param token Token JWT
 * @returns Data de expiração ou null se inválido
 */
export function getTokenExpiration(token: string): Date | null {
  const decoded = decodeJwt(token);
  if (!decoded?.exp) {
    return null;
  }
  // 'exp' está em segundos, Date espera milissegundos
  return new Date(decoded.exp * 1000);
}

/**
 * Verifica se um token está expirado
 * @param token Token JWT
 * @returns true se expirado, false se válido
 */
export function isTokenExpired(token: string): boolean {
  const expiration = getTokenExpiration(token);
  if (!expiration) {
    return true;
  }
  return new Date() >= expiration;
}

/**
 * Calcula quantos milissegundos faltam para o token expirar
 * @param token Token JWT
 * @returns Tempo em ms até expiração, ou 0 se já expirado
 */
export function getTimeUntilExpiration(token: string): number {
  const expiration = getTokenExpiration(token);
  if (!expiration) {
    return 0;
  }
  const now = new Date();
  const diff = expiration.getTime() - now.getTime();
  return Math.max(0, diff);
}

/**
 * Extrai as roles de um token
 * @param token Token JWT
 * @returns Array de roles ou empty array
 */
export function getTokenRoles(token: string): string[] {
  const decoded = decodeJwt(token);
  if (!Array.isArray(decoded?.roles)) {
    return [];
  }
  return decoded.roles as string[];
}

/**
 * Extrai o username (subject) de um token
 * @param token Token JWT
 * @returns Username ou null
 */
export function getTokenUsername(token: string): string | null {
  const decoded = decodeJwt(token);
  return decoded?.sub || null;
}
