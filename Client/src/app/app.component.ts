import { Component, OnInit } from '@angular/core';
import { MJAuthBase } from '@memberjunction/ng-auth-services';
import { environment } from '../environments/environment';
import { setupGraphQLClient, GraphQLProviderConfigData } from '@memberjunction/graphql-dataprovider';
import { lastValueFrom } from 'rxjs';
import { LogError, LogStatus, Metadata, SetProductionStatus } from '@memberjunction/core';
import { SharedService } from '@memberjunction/ng-shared';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Client';
  authBase: MJAuthBase;
  subHeaderText: string = "Welcome back! Please log in to your account.";
  HasError = false;
  ErrorMessage: any = '';
  initalPath = '/';

  constructor(authBase: MJAuthBase) {
    this.authBase = authBase;
  }

  ngOnInit(): void {
    SetProductionStatus(environment.production);
    this.setupAuth();
  }

  async handleLogin(token: string, claims: any) {
    if (token) {
      const url: string = environment.GRAPHQL_URI;
      const wsurl: string = environment.GRAPHQL_WS_URI;

      try {
        const start = Date.now();        
        const config = new GraphQLProviderConfigData(token, url, wsurl, async () => {
          const refresh$ = await this.authBase.refresh();
          const claims = await lastValueFrom(refresh$);
          const token = environment.AUTH_TYPE === 'auth0' ? claims?.__raw : claims?.idToken;
          return token;
        }, environment.MJ_CORE_SCHEMA_NAME);
        await setupGraphQLClient(config);

        const end = Date.now();
        LogStatus(`GraphQL Client Setup took ${end - start}ms`);

        await SharedService.RefreshData(true);

        const md = new Metadata();
        if (!md.CurrentUser) {
          this.HasError = true;
          this.ErrorMessage = `You don't have access to the application, contact your system administrator.`
          throw this.ErrorMessage;
        }

        localStorage.removeItem('jwt-retry-ts');
        if (this.initalPath === '/') {
          setTimeout(() => {
            const drawerElement = document.querySelector('li.k-drawer-item.k-level-0') as any;
            if (drawerElement) drawerElement.click();
          }, 10);
        } else {
          window.location.replace(this.initalPath);
        }
      } catch (err) {
        const retryKey = 'auth-retry-dt';
        const lastRetryDateTime = localStorage.getItem(retryKey);
        const yesterday = +new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

        const retriedRecently = lastRetryDateTime && +new Date(lastRetryDateTime) > yesterday;
        const expiryError = this.authBase.checkExpiredTokenError((err as any)?.response?.errors?.[0]?.message);

        if (!retriedRecently && expiryError) {
          LogStatus('JWT Expired, retrying once: ' + err);
          localStorage.setItem(retryKey, new Date().toISOString());
          const login$ = await this.authBase.login({ appState: { target: window.location.pathname } });
          await lastValueFrom(login$);
        } else {
          this.HasError = true;
          this.ErrorMessage = err;
          LogError('Error Logging In: ' + err);
          throw err;
        }
      }
    }
  }

  setupAuth(): void {
    this.authBase.getUserClaims().subscribe((claims: any) => {
      if (claims) {
        const token = environment.AUTH_TYPE === 'auth0' ? claims?.__raw : claims?.idToken;
        const result = claims.idTokenClaims ? 
                        {...claims, ...claims.idTokenClaims} : 
                        claims;

        this.handleLogin(token, result); 
      }
    }, (err: any) => {
      LogError('Error Logging In: ' + err);
      if(err.name){
        if(err.name === 'BrowserAuthError') {
          this.subHeaderText = "Welcome back! Please log in to your account.";
        }
        else if(err.name === 'InteractionRequiredAuthError'){
          this.subHeaderText = "Your session has expired. Please log in to your account.";
        }
      }

      this.authBase.authenticated = false;
    });
  
    this.authBase.isAuthenticated().subscribe((loggedIn: any) => {
      if (!loggedIn) {
        this.authBase.authenticated = false;
      }
    });  

    this.initalPath = window.location.pathname + (window.location.search ? window.location.search : '');
  }
}
