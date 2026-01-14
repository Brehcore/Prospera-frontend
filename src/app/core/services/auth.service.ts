import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap, throwError, Subscription } from 'rxjs';

import { ApiService } from './api.service';
import { AuthSession, UserProfile } from '../models/user';
import { getTokenExpiration, getTimeUntilExpiration, isTokenExpired } from '../utils/jwt.util';

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  email?: string;
  role?: string;
  profile?: UserProfile;
  user?: UserProfile;
}

interface OrganizationMembership {
  id: string;
  name?: string;
  role: string;
  membershipId?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly tokenKey = 'jwtToken';
  private readonly emailKey = 'loggedInUserEmail';
  private readonly roleKey = 'systemRole';

  private normalizedSystemRole: string | null = null;
  private readonly organizationMemberships = new Map<string, OrganizationMembership>();

  private readonly userSubject = new BehaviorSubject<UserProfile | null>(null);
  readonly user$ = this.userSubject.asObservable();
  readonly isAuthenticated$ = this.user$.pipe(map(Boolean));

  // Auto-refresh de token
  private refreshTimer: any = null;
  private readonly REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // Renovar 5 minutos antes de expirar
  private isRefreshing = false;
  private readonly refreshSubject = new BehaviorSubject<boolean>(false);
  readonly isRefreshing$ = this.refreshSubject.asObservable();

  constructor(private readonly api: ApiService, private readonly router: Router) {
    this.normalizedSystemRole = this.normalizeRole(this.getStoredRole());
    const existingToken = this.getToken();
    if (existingToken) {
      this.fetchProfile().subscribe({
        error: () => this.clearSession()
      });
      // Se token existe e é válido, inicia auto-refresh
      if (!isTokenExpired(existingToken)) {
        this.scheduleTokenRefresh(existingToken);
      } else {
        this.clearSession();
      }
    }
  }

  ngOnDestroy(): void {
    this.stopRefreshTimer();
  }

  login(payload: LoginPayload): Observable<UserProfile> {
    return this.api.post<LoginResponse>('/auth/login', payload, { withCredentials: true }).pipe(
      tap(response => {
        this.persistSession(response);
        // Inicia auto-refresh após login bem-sucedido
        if (response.token && !isTokenExpired(response.token)) {
          this.scheduleTokenRefresh(response.token);
        }
      }),
      switchMap(response => {
        if (response.profile || response.user) {
          const profile = (response.profile || response.user) as UserProfile;
          const enriched = this.enrichProfile(profile, response.email ?? payload.email);
          this.userSubject.next(enriched);
          this.syncRoleCaches(enriched);
          return of(this.userSubject.value!);
        }
        return this.fetchProfile({ suppressNavigation: true });
      })
    );
  }

  register(payload: RegisterPayload): Observable<void> {
    return this.api.post<void>('/auth/register', payload);
  }

  logout(): void {
    this.stopRefreshTimer();
    this.clearSession();
    // Redireciona para home em vez de rota de login (login agora é modal)
    this.router.navigate(['/']);
  }

  hasRole(role: string): boolean {
    const normalized = this.normalizeRole(role);
    if (!normalized) {
      return false;
    }
    if (this.hasSystemRole(normalized)) {
      return true;
    }
    return this.hasOrganizationRole(normalized);
  }

  fetchProfile(options: { suppressNavigation?: boolean } = {}): Observable<UserProfile> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('Token ausente.'));
    }
    return this.api.get<UserProfile>('/profile/me').pipe(
      tap(profile => {
        const enriched = this.enrichProfile(profile);
        this.userSubject.next(enriched);
        this.syncRoleCaches(enriched);
      }),
      catchError(error => {
        this.clearSession();
        if (!options.suppressNavigation) {
          // Em caso de falha ao recuperar perfil, volta para home
          this.router.navigate(['/']);
        }
        return throwError(() => error);
      })
    );
  }

  updateProfile(changes: Partial<UserProfile>): Observable<UserProfile> {
    // O endpoint de perfil do backend espera POST em /profile/pf com o corpo: { fullName, cpf, birthDate, phone }
    return this.api.post<UserProfile | null>('/profile/pf', changes).pipe(
      map(profile => {
        const previous = this.userSubject.value;
        if (!profile) {
          return this.enrichProfile(previous ?? {}, undefined, previous);
        }
        return this.enrichProfile(profile, undefined, previous);
      }),
      tap(enriched => {
        this.userSubject.next(enriched);
        this.syncRoleCaches(enriched);
      })
    );
  }

  updatePassword(newPassword: string, currentPassword?: string): Observable<void> {
    const payload = currentPassword ? { oldPassword: currentPassword, password: newPassword } : { password: newPassword };
    return this.api.patch<void>('/profile/password', payload);
  }

  isAuthenticated(): boolean {
    return !!this.userSubject.value && !!this.getToken();
  }

  getToken(): string | null {
    try {
      return localStorage.getItem(this.tokenKey);
    } catch {
      return null;
    }
  }

  getStoredEmail(): string | null {
    try {
      return localStorage.getItem(this.emailKey);
    } catch {
      return null;
    }
  }

  getRole(): string | null {
    if (this.normalizedSystemRole) {
      return this.normalizedSystemRole;
    }
    const stored = this.getStoredRole();
    const normalized = this.normalizeRole(stored);
    if (normalized && this.isSystemRoleValue(normalized)) {
      return normalized;
    }
    return normalized;
  }

  getSystemRole(): string | null {
    return this.normalizedSystemRole;
  }

  hasSystemRole(role: string): boolean {
    const normalized = this.normalizeRole(role);
    if (!normalized) {
      return false;
    }
    return this.normalizedSystemRole === normalized;
  }

  isSystemAdmin(): boolean {
    return this.hasSystemRole('SYSTEM_ADMIN');
  }

  hasOrganizationRole(role: string, organizationId?: string): boolean {
    const normalized = this.normalizeRole(role);
    if (!normalized) {
      return false;
    }
    if (normalized === 'ORG_ADMIN' && this.hasSystemRole('SYSTEM_ADMIN')) {
      return true;
    }
    if (normalized === 'ORG_MEMBER' && this.hasSystemRole('SYSTEM_ADMIN')) {
      return true;
    }
    if (organizationId) {
      const membership = this.organizationMemberships.get(String(organizationId));
      if (membership) {
        if (membership.role === normalized) {
          return true;
        }
        if (normalized === 'ORG_MEMBER' && membership.role === 'MEMBER') {
          return true;
        }
        if (normalized === 'ORG_MEMBER' && membership.role === 'ORG_ADMIN') {
          return true;
        }
        if (normalized === 'ORG_ADMIN' && this.isSystemRoleValue(membership.role)) {
          return true;
        }
        return false;
      }
    }
    for (const membership of this.organizationMemberships.values()) {
      if (membership.role === normalized) {
        return true;
      }
      if (normalized === 'ORG_MEMBER' && membership.role === 'MEMBER') {
        return true;
      }
      if (normalized === 'ORG_MEMBER' && membership.role === 'ORG_ADMIN') {
        return true;
      }
      if (normalized === 'ORG_ADMIN' && this.isSystemRoleValue(membership.role)) {
        return true;
      }
    }

  const normalizedRoles = this.collectNormalizedRolesFromProfile(this.userSubject.value);
    if (normalizedRoles.includes(normalized)) {
      return true;
    }
    if (normalized === 'ORG_MEMBER' && normalizedRoles.includes('MEMBER')) {
      return true;
    }
    if (normalized === 'ORG_ADMIN' && (normalizedRoles.includes('ADMIN') || normalizedRoles.includes('SYSTEM_ADMIN'))) {
      return true;
    }

    try {
      if (normalized === 'ORG_ADMIN' && sessionStorage.getItem('isCompanyAdmin') === 'true') {
        return true;
      }
      if (normalized === 'ORG_MEMBER' && sessionStorage.getItem('hasMembership') === 'true') {
        return true;
      }
    } catch {
      /* ignore */
    }

    return false;
  }

  isOrgAdmin(organizationId?: string): boolean {
    return this.hasOrganizationRole('ORG_ADMIN', organizationId);
  }

  isOrgMember(organizationId?: string): boolean {
    return this.hasOrganizationRole('ORG_MEMBER', organizationId) || this.hasOrganizationRole('MEMBER', organizationId);
  }

  getOrganizationMemberships(): OrganizationMembership[] {
    return Array.from(this.organizationMemberships.values());
  }

  getOrganizations(): Array<Record<string, unknown>> {
    const organizations = this.userSubject.value?.organizations;
    return Array.isArray(organizations) ? organizations : [];
  }

  private persistSession(response: LoginResponse): void {
    if (!response?.token) {
      return;
    }
    try {
      localStorage.setItem(this.tokenKey, response.token);
      const email = response.email
        ?? response.profile?.email
        ?? response.user?.email
        ?? this.userSubject.value?.email;
      if (email) {
        localStorage.setItem(this.emailKey, email);
      }
      const normalizedRole = this.extractSystemRoleFromResponse(response);
      if (normalizedRole) {
        localStorage.setItem(this.roleKey, normalizedRole);
        this.normalizedSystemRole = normalizedRole;
      }
    } catch (error) {
      console.warn('[AuthService] não foi possível persistir a sessão', error);
    }
  }

  private getStoredRole(): string | null {
    try {
      return localStorage.getItem(this.roleKey);
    } catch {
      return null;
    }
  }

  private clearSession(): void {
    this.stopRefreshTimer();
    try {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.emailKey);
      localStorage.removeItem(this.roleKey);
    } catch (error) {
      console.warn('[AuthService] falha ao limpar sessão', error);
    }
    this.clearOrganizationFlags();
    this.organizationMemberships.clear();
    this.normalizedSystemRole = null;
    this.userSubject.next(null);
  }

  private enrichProfile(profile: Partial<UserProfile> | null | undefined, fallbackEmail?: string, previous?: UserProfile | null): UserProfile {
    const prior = previous ?? this.userSubject.value ?? null;
    const safeProfile = profile ?? {};
    const email = safeProfile.email ?? fallbackEmail ?? prior?.email ?? this.getStoredEmail() ?? '';
    const merged: UserProfile = {
      ...(prior ?? {}),
      ...safeProfile,
      email
    };

    if (!safeProfile.organizations && prior?.organizations) {
      merged.organizations = prior.organizations;
    }
    if (!safeProfile.company && prior?.company) {
      merged.company = prior.company;
    }
    if (!safeProfile.personalProfile && prior?.personalProfile) {
      merged.personalProfile = prior.personalProfile;
    }
    if (!safeProfile.profile && prior?.profile) {
      merged.profile = prior.profile;
    }
    return merged;
  }

  private syncRoleCaches(profile: UserProfile | null): void {
    const systemRole = this.resolveSystemRole(profile);
    if (systemRole) {
      this.normalizedSystemRole = systemRole;
      try {
        localStorage.setItem(this.roleKey, systemRole);
      } catch (error) {
        console.warn('[AuthService] não foi possível armazenar systemRole', error);
      }
    } else {
      this.normalizedSystemRole = null;
      try {
        localStorage.removeItem(this.roleKey);
      } catch (error) {
        console.warn('[AuthService] não foi possível limpar systemRole', error);
      }
    }

    const memberships = this.collectOrganizationMemberships(profile);
    this.clearOrganizationFlags();
    this.organizationMemberships.clear();
    memberships.forEach(membership => this.organizationMemberships.set(membership.id, membership));
    this.persistOrganizationFlags(memberships);
  }

  private resolveSystemRole(profile: UserProfile | null): string | null {
    if (!profile) {
      const stored = this.normalizeRole(this.getStoredRole());
      return stored && this.isSystemRoleValue(stored) ? stored : null;
    }
    const candidates: unknown[] = [
      (profile as any)?.systemRole,
      profile.role,
      (profile as any)?.roles,
      (profile as any)?.authorities,
      (profile as any)?.permissions,
      (profile as any)?.profile?.systemRole,
      (profile as any)?.profile?.role,
      (profile as any)?.profile?.roles,
      (profile as any)?.profile?.authorities,
      (profile as any)?.profile?.permissions,
      (profile as any)?.personalProfile?.systemRole,
      (profile as any)?.personalProfile?.role,
      (profile as any)?.personalProfile?.roles,
      (profile as any)?.personalProfile?.authorities,
      (profile as any)?.personalProfile?.permissions,
      (profile as any)?.company?.role,
      (profile as any)?.company?.roles,
      (profile as any)?.company?.authorities
    ];
    const visited = new WeakSet<object>();
    for (const candidate of candidates) {
      const roles = Array.from(this.extractNormalizedRoles(candidate, visited));
      const systemRole = roles.find(role => this.isSystemRoleValue(role));
      if (systemRole) {
        return systemRole;
      }
    }
    return null;
  }

  private collectOrganizationMemberships(profile: UserProfile | null): OrganizationMembership[] {
    const organizations = Array.isArray(profile?.organizations) ? profile!.organizations : [];
    const memberships: OrganizationMembership[] = [];
    for (const raw of organizations) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }
      const organization = raw as Record<string, unknown>;
      const id = this.extractOrganizationId(organization);
      if (!id) {
        continue;
      }
      const role = this.extractOrganizationRole(organization);
      if (!role) {
        continue;
      }
      memberships.push({
        id,
        role,
        name: this.extractOrganizationName(organization),
        membershipId: this.extractOrganizationMembershipId(organization)
      });
    }
    return memberships;
  }

  private extractOrganizationId(organization: Record<string, unknown>): string | null {
    const candidates = [
      organization['organizationId'],
      organization['organization_id'],
      organization['orgId'],
      organization['org_id'],
      organization['id'],
      organization['_id'],
      organization['uuid'],
      organization['code'],
      organization['slug']
    ];
    for (const candidate of candidates) {
      if (candidate != null && candidate !== '') {
        return String(candidate);
      }
    }
    return null;
  }

  private extractOrganizationRole(organization: Record<string, unknown>): string | null {
    const candidates = [
      organization['yourRole'],
      organization['your_role'],
      organization['role'],
      organization['userRole'],
      organization['membershipRole'],
      organization['membership_role']
    ];
    for (const candidate of candidates) {
      const normalized = this.normalizeRole(candidate);
      if (normalized && !this.isSystemRoleValue(normalized)) {
        return normalized;
      }
    }
    return null;
  }

  private extractOrganizationMembershipId(organization: Record<string, unknown>): string | undefined {
    const candidates = [
      organization['membershipId'],
      organization['membership_id'],
      organization['membership'],
      organization['membershipid']
    ];
    for (const candidate of candidates) {
      if (candidate != null && candidate !== '') {
        return String(candidate);
      }
    }
    return undefined;
  }

  private extractOrganizationName(organization: Record<string, unknown>): string | undefined {
    const candidates = [
      organization['organizationName'],
      organization['name'],
      organization['companyName'],
      organization['razaoSocial'],
      organization['legalName']
    ];
    for (const candidate of candidates) {
      if (candidate != null && candidate !== '') {
        return String(candidate);
      }
    }
    return undefined;
  }

  private persistOrganizationFlags(memberships: OrganizationMembership[]): void {
    let hasAdmin = false;
    for (const membership of memberships) {
      if (membership.role === 'ORG_ADMIN' || membership.role === 'ADMIN' || membership.role === 'SYSTEM_ADMIN') {
        hasAdmin = true;
      }
      try {
        sessionStorage.setItem(`myOrgRole_${membership.id}`, membership.role);
      } catch {
        /* ignore */
      }
      if (membership.membershipId) {
        try {
          sessionStorage.setItem(`myMembershipId_${membership.id}`, membership.membershipId);
        } catch {
          /* ignore */
        }
      }
      if (membership.name) {
        try {
          sessionStorage.setItem(`orgName_${membership.id}`, membership.name);
        } catch {
          /* ignore */
        }
      }
    }
    try {
      if (memberships.length > 0) {
        sessionStorage.setItem('hasMembership', 'true');
      } else {
        sessionStorage.removeItem('hasMembership');
      }
    } catch {
      /* ignore */
    }
    try {
      if (hasAdmin) {
        sessionStorage.setItem('isCompanyAdmin', 'true');
      } else {
        sessionStorage.removeItem('isCompanyAdmin');
      }
    } catch {
      /* ignore */
    }
  }

  private clearOrganizationFlags(): void {
    for (const membership of this.organizationMemberships.values()) {
      try {
        sessionStorage.removeItem(`myOrgRole_${membership.id}`);
        sessionStorage.removeItem(`myMembershipId_${membership.id}`);
        sessionStorage.removeItem(`orgName_${membership.id}`);
      } catch {
        /* ignore */
      }
    }
    try {
      sessionStorage.removeItem('hasMembership');
      sessionStorage.removeItem('isCompanyAdmin');
      sessionStorage.removeItem('currentOrganizationId');
      sessionStorage.removeItem('currentOrganizationName');
    } catch {
      /* ignore */
    }
  }

  private normalizeRole(role: unknown): string | null {
    if (role == null) {
      return null;
    }
    if (Array.isArray(role)) {
      for (const value of role) {
        const normalized = this.normalizeRole(value);
        if (normalized) {
          return normalized;
        }
      }
      return null;
    }
    const value = String(role).trim();
    if (!value) {
      return null;
    }
    return value
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private isSystemRoleValue(role: string | null): boolean {
    if (!role) {
      return false;
    }
    return role === 'SYSTEM_ADMIN' || role === 'ADMIN' || role.startsWith('SYSTEM_');
  }

  private collectNormalizedRolesFromProfile(profile: UserProfile | null | undefined): string[] {
    if (!profile) {
      return [];
    }
    const visited = new WeakSet<object>();
    const normalizedRoles = new Set<string>();
    const candidates: unknown[] = [
      profile,
      profile.company,
      profile.personalProfile,
      profile.profile,
      profile.organizations
    ];
    for (const candidate of candidates) {
      for (const normalized of this.extractNormalizedRoles(candidate, visited)) {
        normalizedRoles.add(normalized);
      }
    }
    return Array.from(normalizedRoles);
  }

  private extractNormalizedRoles(candidate: unknown, visited: WeakSet<object>): Set<string> {
    const result = new Set<string>();
    if (!candidate) {
      return result;
    }

    if (typeof candidate === 'string') {
      const normalized = this.normalizeRole(candidate);
      if (normalized) {
        result.add(normalized);
      }
      return result;
    }

    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        for (const normalized of this.extractNormalizedRoles(item, visited)) {
          result.add(normalized);
        }
      }
      return result;
    }

    if (typeof candidate === 'object') {
      const obj = candidate as Record<string, unknown>;
      if (visited.has(obj)) {
        return result;
      }
      visited.add(obj);

      const directKeys = [
        'role',
        'systemRole',
        'system_role',
        'yourRole',
        'your_role',
        'membershipRole',
        'membership_role',
        'userRole',
        'orgRole',
        'org_role',
        'roleName',
        'role_name',
        'companyRole',
        'membershipRoles',
        'roles',
        'authorities',
        'permissions',
        'position'
      ];
      for (const key of directKeys) {
        if (key in obj) {
          for (const normalized of this.extractNormalizedRoles(obj[key], visited)) {
            result.add(normalized);
          }
        }
      }

      const nestedKeys = ['profile', 'personalProfile', 'company', 'organization', 'organizationInfo'];
      for (const key of nestedKeys) {
        if (key in obj) {
          for (const normalized of this.extractNormalizedRoles(obj[key], visited)) {
            result.add(normalized);
          }
        }
      }

      if ('organizations' in obj) {
        for (const normalized of this.extractNormalizedRoles(obj['organizations'], visited)) {
          result.add(normalized);
        }
      }
      if ('memberships' in obj) {
        for (const normalized of this.extractNormalizedRoles(obj['memberships'], visited)) {
          result.add(normalized);
        }
      }
      if ('membership' in obj) {
        for (const normalized of this.extractNormalizedRoles(obj['membership'], visited)) {
          result.add(normalized);
        }
      }
      return result;
    }

    const normalized = this.normalizeRole(candidate);
    if (normalized) {
      result.add(normalized);
    }
    return result;
  }

  private extractSystemRoleFromResponse(response: LoginResponse | null | undefined): string | null {
    if (!response) {
      return null;
    }
    const candidates: unknown[] = [
      response.role,
      response.profile?.['systemRole'],
      response.user?.['systemRole'],
      response.profile?.role,
      response.user?.role,
      (response.profile as any)?.roles,
      (response.profile as any)?.authorities,
      (response.profile as any)?.permissions,
      (response.user as any)?.roles,
      (response.user as any)?.authorities,
      (response.user as any)?.permissions
    ];
    const visited = new WeakSet<object>();
    for (const candidate of candidates) {
      const roles = Array.from(this.extractNormalizedRoles(candidate, visited));
      const systemRole = roles.find(value => this.isSystemRoleValue(value));
      if (systemRole) {
        return systemRole;
      }
    }
    return null;
  }

  /**
   * Agenda renovação automática do token JWT
   * Renovará 5 minutos antes da expiração
   */
  private scheduleTokenRefresh(token: string): void {
    this.stopRefreshTimer(); // Limpar timer anterior se houver

    const timeUntilExpire = getTimeUntilExpiration(token);
    if (timeUntilExpire <= 0) {
      console.warn('[AuthService] Token já expirado, não agendando refresh');
      this.clearSession();
      return;
    }

    // Calcular quando fazer refresh (5 min antes de expirar)
    const refreshIn = Math.max(0, timeUntilExpire - this.REFRESH_THRESHOLD_MS);
    const expirationDate = getTokenExpiration(token);

    console.log(
      '[AuthService] Token agendado para refresh em',
      Math.round(refreshIn / 1000),
      'segundos (expira em',
      expirationDate?.toLocaleTimeString() ?? 'data desconhecida',
      ')'
    );

    // Agendar refresh para 5 minutos antes da expiração
    this.refreshTimer = setTimeout(() => {
      this.attemptTokenRefresh();
    }, refreshIn) as any;
  }

  /**
   * Tenta renovar o token JWT chamando /auth/refresh
   * Se falhar, faz logout automático
   */
  private attemptTokenRefresh(): void {
    const currentToken = this.getToken();
    if (!currentToken || this.isRefreshing) {
      return;
    }

    console.log('[AuthService] Tentando renovar token...');
    this.isRefreshing = true;
    this.refreshSubject.next(true);

    this.api.post<LoginResponse>('/auth/refresh', {}, { withCredentials: true }).subscribe({
      next: response => {
        this.isRefreshing = false;
        this.refreshSubject.next(false);

        if (response?.token) {
          console.log('[AuthService] Token renovado com sucesso');
          this.persistSession(response);
          this.scheduleTokenRefresh(response.token);
        } else {
          console.warn('[AuthService] Refresh retornou token vazio');
          this.clearSession();
        }
      },
      error: error => {
        this.isRefreshing = false;
        this.refreshSubject.next(false);
        console.warn('[AuthService] Falha ao renovar token:', error?.message || error);
        // Se refresh falhar, fazer logout
        this.clearSession();
      }
    });
  }

  /**
   * Para o timer de auto-refresh
   */
  private stopRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
