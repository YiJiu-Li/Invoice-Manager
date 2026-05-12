export interface AuthUser {
  id: number;
  username: string;
  display_name: string | null;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface UserCreateRequest {
  username: string;
  password: string;
  display_name?: string;
  is_admin?: boolean;
}
