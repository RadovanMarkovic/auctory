import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Bot } from "lucide-react";

import { AssistantChat } from "@/components/assistant/AssistantChat";
import { ConversationList } from "@/components/assistant/ConversationList";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "Assistant — Auctory" },
      { name: "description", content: "Chat with the Auctory assistant about auctions, products and platform rules." },
      { property: "og:title", content: "Assistant — Auctory" },
      { property: "og:description", content: "Chat with the Auctory assistant about auctions, products and platform rules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  const { t } = useTranslation();
  const [conversationId, setConversationId] = useState<string | null>(null);

  return (
    <div className="container mx-auto flex h-[calc(100dvh-8rem)] max-w-5xl flex-col px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Bot className="h-6 w-6" />
        <h1 className="font-serif text-2xl">{t("assistant.title")}</h1>
      </div>
      <div className="flex min-h-0 flex-1 rounded-xl border bg-card">
        <aside className="hidden w-64 border-r md:block">
          <ConversationList
            activeId={conversationId}
            onSelect={setConversationId}
            onNew={() => setConversationId(null)}
          />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b md:hidden">
            <ConversationList
              activeId={conversationId}
              onSelect={setConversationId}
              onNew={() => setConversationId(null)}
            />
          </div>
          <AssistantChat
            conversationId={conversationId}
            onConversationCreated={setConversationId}
          />
        </div>
      </div>
    </div>
  );
}
