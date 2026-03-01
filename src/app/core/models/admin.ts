export type AdminTrainingFormat = 'EBOOK' | 'RECORDED_COURSE' | 'LIVE_TRAINING' | 'PACKAGE' | string;
export type AdminTrainingStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | string;

/**
 * Representa uma página de resultados com paginação.
 * Compatível com Spring Data Page<T>.
 */
export interface Page<T> {
  content: T[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: { empty: boolean; sorted: boolean; unsorted: boolean };
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
  sort: { empty: boolean; sorted: boolean; unsorted: boolean };
}

/**
 * Resumo simplificado de um usuário administrativo.
 */
export interface AdminUserSummary {
  id: string;
  email: string;
  enabled: boolean;
  role?: string | null;
  [key: string]: unknown;
}

/**
 * Detalhes completos de um usuário administrativo.
 * Inclui informações pessoais e administrativas.
 */
export interface AdminUserDetailDTO {
  id: string;
  email: string;
  enabled: boolean;
  role?: string | null;
  fullName?: string | null;
  cpf?: string | null;
  birthDate?: string | null; // formato: YYYY-MM-DD
  phone?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

/**
 * Payload para atualizar informações de um usuário administrativo.
 * Suporta atualização parcial de campos.
 */
export interface AdminUserUpdateRequest {
  email?: string;
  role?: string;
  enabled?: boolean;
  fullName?: string;
  cpf?: string;
  birthDate?: string; // formato: YYYY-MM-DD
  phone?: string;
  [key: string]: unknown;
}

export interface AdminTraining {
  id: string;
  title: string;
  description?: string | null;
  author?: string | null;
  entityType?: AdminTrainingFormat | null;
  publicationStatus?: AdminTrainingStatus | null;
  coverImageUrl?: string | null;
  organizationId?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface AdminTrainingPayload {
  title: string;
  description?: string;
  author?: string;
  entityType: AdminTrainingFormat;
  organizationId?: string;
}

export interface AdminTrainingUpdatePayload {
  title?: string;
  description?: string;
  author?: string;
}

export interface AssignTrainingPayload {
  sectorId: string;
  trainingType: string;
  legalBasis?: string;
}

export interface AdminSector {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface EbookProgress {
  lastPageRead?: number | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export type EbookUploadEvent =
  | { type: 'progress'; progress: number }
  | { type: 'response'; body: unknown };

// --- DTOs / Requests for module/lesson management ---
export interface ModuleUpdateRequest {
  title?: string;
  moduleOrder?: number | null;
}

export interface LessonUpdateRequest {
  title?: string;
  content?: string | null;
  lessonOrder?: number | null;
  videoUrl?: string | null;
}

export interface ReorderItem {
  id: string;
  newOrder: number;
}

export interface ReorderRequest {
  items: ReorderItem[];
}
