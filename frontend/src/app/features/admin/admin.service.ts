import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { Role, User } from "../../core/models/user.model";

@Injectable({ providedIn: "root" })
export class AdminService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listUsers(): Observable<{ users: User[] }> {
    return this.http.get<{ users: User[] }>(`${this.apiUrl}/admin/users`);
  }

  changeRole(userId: string, role: Role): Observable<{ user: User }> {
    return this.http.patch<{ user: User }>(`${this.apiUrl}/admin/users/${userId}/role`, {
      role,
    });
  }
}
