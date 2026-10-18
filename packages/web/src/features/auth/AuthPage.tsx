import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin, useRegister } from "./hooks";
import { ApiError } from "@/lib/api";
import { Sparkles } from "lucide-react";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const login = useLogin();
  const register = useRegister();

  const busy = login.isPending || register.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (mode === "login") await login.mutateAsync({ email, password });
      else await register.mutateAsync({ email, password, name });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold">Notionish</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Welcome back" : "Create your workspace"}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus={mode === "login"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button className="text-foreground underline underline-offset-4" onClick={() => setMode("register")}>
                Create one
              </button>
            </>
          ) : (
            <>
              Already have one?{" "}
              <button className="text-foreground underline underline-offset-4" onClick={() => setMode("login")}>
                Sign in
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
