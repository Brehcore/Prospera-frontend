import { HttpContextToken } from '@angular/common/http';

// Quando true, instruímos interceptors (ex.: auth) a não adicionar Authorization
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
