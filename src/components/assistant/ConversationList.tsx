import { Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  useAssistantConversations,
  useDeleteConversation,
} from "@/lib/assistant";

export function ConversationList({
  activeId,
  onSelect,
  onNew,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const { t } = useTranslation();
  const conversations = useAssistantConversations(true);
  const remove = useDeleteConversation();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-2">
        <Button variant="outline" size="sm" className="w-full" onClick={onNew}>
          <MessageSquarePlus className="mr-1.5 h-4 w-4" />
          {t("assistant.newConversation")}
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {conversations.isPending ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (conversations.data ?? []).length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            {t("assistant.noConversations")}
          </p>
        ) : (
          (conversations.data ?? []).map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
                c.id === activeId ? "bg-muted font-medium" : "hover:bg-muted/60"
              }`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => onSelect(c.id)}
              >
                {c.title || t("assistant.untitled")}
              </button>
              <button
                type="button"
                aria-label={t("assistant.deleteConversation")}
                className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(c.id, {
                    onSuccess: () => {
                      if (c.id === activeId) onNew();
                    },
                  })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
