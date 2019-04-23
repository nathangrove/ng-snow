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
      let token = document.getElementsByTagName("app-root")[0].getAttribute("token");
      let changedReq;
      if (typeof token !== 'undefined' && token !== '') {
        changedReq = req.clone({headers: req.headers.set('X-UserToken', token )});
      } else { changedReq = req; }
      return next.handle(changedReq);
    } else {
      return next.handle(req);
    }
  }
}
