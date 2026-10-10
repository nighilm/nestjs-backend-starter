export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthenticatedSession {
  id: string;
  userId: string;
}

export interface AuthenticatedRequest {
  user: AuthUser;
  session: AuthenticatedSession;
}
