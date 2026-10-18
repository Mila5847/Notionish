import { AuthPage } from "@/features/auth/AuthPage";
import { useMe } from "@/features/auth/hooks";
import { AppShell } from "./AppShell";

export function App() {
  const { data: me, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    );
  }

  if (!me) return <AuthPage />;
  return <AppShell />;
}
