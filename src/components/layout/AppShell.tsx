import type { ReactNode } from "react";

import { AssistantLauncher } from "@/components/assistant/AssistantLauncher";

import { Footer } from "./Footer";
import { Header } from "./Header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <AssistantLauncher />
    </div>
  );
}
