import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, map } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class CsrfService {
  constructor(private http: HttpClient) {}

  getToken(): Observable<string> {
    return this.http
      .get<{ csrfToken: string }>(`${environment.apiUrl}/csrf-token`, {
        withCredentials: true,
      })
      .pipe(map((res) => res.csrfToken));
  }
}