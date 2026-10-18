import { useMe } from "@/features/auth/hooks";
import { AppShell } from "./AppShell";

export function App() {
  const { data: me, isLoading, error } = useMe();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    );
  }

  // Sign-in is handled by Home Assistant; without a user we were opened some other way.
  if (!me) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <h2 className="text-lg font-semibold">Open Notionish from Home Assistant</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {error?.message ?? "Notionish uses your Home Assistant account."}
        </p>
      </div>
    );
  }

  return <AppShell />;
}
