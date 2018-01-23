/**
*
*   This interceptor will auth the X-UserToken to the request header for authenticated API requests
*   once deployed to the ServiceNow platform.
*
*   If your application is running on the localhost development server, it will work
*   without this interceptor. However, your appplication will break once deployed.
*
*/

import {Injectable} from '@angular/core';
import {HttpEvent, HttpInterceptor, HttpHandler, HttpRequest} from '@angular/common/http';

import {Observable} from 'rxjs/Observable';

@Injectable()
export class SnowInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (/^\/api/.test(req.url)) {
      let changedReq;
      if (typeof window['_g_ck'] !== 'undefined' && window['_g_ck'] !== '') {
        changedReq = req.clone({headers: req.headers.set('X-UserToken', window['_g_ck'])});
      } else { changedReq = req; }
      return next.handle(changedReq);
    } else {
      return next.handle(req);
    }
  }
}
