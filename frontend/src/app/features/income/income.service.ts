import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { Income, IncomePayload } from "../../core/models/income.model";

@Injectable({ providedIn: "root" })
export class IncomeService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  list(): Observable<{ incomes: Income[] }> {
    return this.http.get<{ incomes: Income[] }>(`${this.apiUrl}/income`);
  }

  create(payload: IncomePayload): Observable<{ income: Income }> {
    return this.http.post<{ income: Income }>(`${this.apiUrl}/income`, payload);
  }

  update(id: string, payload: Partial<IncomePayload>): Observable<{ income: Income }> {
    return this.http.put<{ income: Income }>(`${this.apiUrl}/income/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/income/${id}`);
  }
}