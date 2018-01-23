import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  users: any;

  constructor(
    private http: HttpClient) { }

  ngOnInit() {
    // make an api call. Treat the "HttpClient" service just as you would the standard Http service.
    this.http.get<any>('/api/now/table/sys_user?sysparm_fields=first_name,last_name,email,sys_created_on').subscribe( res => {

      // let's take the response, parse the dates and store it in a users array
      this.users = res.result.map( user => {
        user.sys_created_on = new Date(user.sys_created_on);
        return user;

      // a quick and dirty sort...
      }).sort( (a,b) => `${a.first_name}${a.last_name}` < `${b.first_name}${b.last_name}` ? - 1 : 1);

    });
  }

}
