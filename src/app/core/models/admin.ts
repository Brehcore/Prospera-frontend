export type AdminTrainingFormat = 'EBOOK' | 'RECORDED_COURSE' | 'LIVE_TRAINING' | 'PACKAGE' | string;
export type AdminTrainingStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | string;

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
