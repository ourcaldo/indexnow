import { AuthProvider } from '@/hooks/use-auth';

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
