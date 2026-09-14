export interface JwtPayload {
  sub: string; // Supabase user ID (UUID)
  email?: string;
  user_metadata?: {
    name?: string;
    full_name?: string;
    avatar_url?: string;
    picture?: string;
  };
  role?: string;
  exp?: number;
  iat?: number;
}

export interface AuthenticatedUser {
  id: string; // Supabase user ID
  email: string;
  name: string;
  avatarUrl?: string | null;
}
