import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App } from "./app/App";
import "./styles/globals.css";

const KNOWN_BLOCKNOTE_ERRORS =
  /Position\s+\S+\s+out of range|Cannot read properties of null \(reading 'append'\)|Cannot read properties of undefined \(reading 'toLowerCase'\)|Cannot read properties of undefined \(reading 'colIndex'\)|TextSelection endpoint not pointing/i;

window.addEventListener("error", (e) => {
  const msg = e.error instanceof Error ? e.error.message : String(e.message ?? "");
  if (KNOWN_BLOCKNOTE_ERRORS.test(msg)) e.preventDefault();
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "");
  if (KNOWN_BLOCKNOTE_ERRORS.test(msg)) e.preventDefault();
});

const originalError = console.error;
console.error = (...args: unknown[]) => {
  const first = args[0];
  const text =
    first instanceof Error
      ? first.message
      : typeof first === "string"
        ? first + " " + args.slice(1).map((a) => (a instanceof Error ? a.message : String(a))).join(" ")
        : String(first ?? "");
  if (KNOWN_BLOCKNOTE_ERRORS.test(text)) return;
  originalError(...(args as [any]));
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <App />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
