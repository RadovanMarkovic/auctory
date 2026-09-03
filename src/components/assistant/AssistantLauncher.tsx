import { useState } from "react";
import { Bot, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { ConversationList } from "@/components/assistant/ConversationList";
import { useAuth } from "@/lib/auth-context";

/**
 * Floating assistant button with a slide-over chat panel. Only rendered for
 * signed-in users; both views reuse the same conversation components.
 */
export function AssistantLauncher() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  if (!user) return null;

  return (
    <>
      <Button
        size="icon"
        className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full shadow-lg"
        aria-label={t("assistant.open")}
        onClick={() => setOpen(true)}
      >
        <Bot className="h-5 w-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-xl">
          <SheetHeader className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Bot className="h-5 w-5" />
                {t("assistant.title")}
              </SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("assistant.close")}
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>
          <div className="flex min-h-0 flex-1">
            <div className="hidden w-44 border-r sm:block">
              <ConversationList
                activeId={conversationId}
                onSelect={setConversationId}
                onNew={() => setConversationId(null)}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="border-b p-2 sm:hidden">
                <ConversationList
                  activeId={conversationId}
                  onSelect={setConversationId}
                  onNew={() => setConversationId(null)}
                />
              </div>
              <AssistantChat
                variant="panel"
                conversationId={conversationId}
                onConversationCreated={setConversationId}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
