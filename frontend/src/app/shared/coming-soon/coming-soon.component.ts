import { Component } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";

/**
 * Vista genérica reutilizable para cualquier sección todavía no
 * implementada. El título se pasa vía `data: { title: '...' }` en la
 * definición de la ruta (ver app.routes.ts).
 */
@Component({
  selector: "app-coming-soon",
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container" style="text-align:center;">
      <h2>{{ title }}</h2>
      <p style="color:#777; margin: 16px 0;">
        Esta vista se implementará en otro momento.
      </p>
      <a routerLink="/dashboard">Volver al dashboard</a>
    </div>
  `,
})
export class ComingSoonComponent {
  title: string;

  constructor(private route: ActivatedRoute) {
    this.title = (this.route.snapshot.data["title"] as string) ?? "Próximamente";
  }
}