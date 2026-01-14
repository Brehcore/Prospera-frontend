import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { isTokenExpired } from '../utils/jwt.util';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token && !req.headers.has('Authorization')) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Se receber 401 Unauthorized, pode ser porque o token expirou
        if (error.status === 401) {
          console.warn('[AuthInterceptor] Recebido 401 - Token pode ter expirado ou sido invalidado');
          // O frontend verificará se o token está realmente expirado
          if (isTokenExpired(token)) {
            console.log('[AuthInterceptor] Token confirmado como expirado, fazendo logout');
            authService.logout();
          }
        }
        return throwError(() => error);
      })
    );
  }

  return next(req);
};
