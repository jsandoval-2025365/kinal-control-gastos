import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { NotificationContainerComponent } from "./shared/coming-soon/notifications/notification-container.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, NotificationContainerComponent],
  template: `
    <router-outlet></router-outlet>
    <app-notification-container></app-notification-container>
  `,
})
export class AppComponent {}