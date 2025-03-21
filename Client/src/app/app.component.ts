import { Component, OnInit } from '@angular/core';
import { MJAuthBase } from '@memberjunction/ng-auth-services';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Client';
  authBase: MJAuthBase;

  constructor(authBase: MJAuthBase) {
    this.authBase = authBase;
  }

  ngOnInit(): void {
    this.setupAuth();
  }

  setupAuth(): void {
    this.authBase.checkUserClaims().subscribe((isAuthenticated: boolean) => {
      if (!isAuthenticated) {
        this.handleLogin();
      }
    });
  }

  handleLogin(): void {
    this.authBase.login().subscribe(() => {
      // Handle post-login actions here
    });
  }
}
