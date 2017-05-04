import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  branding = 'API Call Example';

  constructor(
  ) { }

  ngOnInit() {
    document.title = this.branding;
  }
}
