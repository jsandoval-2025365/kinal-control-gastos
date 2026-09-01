export type Role = "USER" | "ADMIN";

export interface User {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
}
