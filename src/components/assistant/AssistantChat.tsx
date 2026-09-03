import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, RefreshCw, SendHorizonal } from "lucide-react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useAssistantMessages,
  useSendAssistantMessage,
  type ConversationMessageDto,
} from "@/lib/assistant";
import { MAX_INPUT_LENGTH } from "@/lib/assistant/core";

function MessageBubble({ message }: { message: ConversationMessageDto }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
            : "max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm"
        }
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="[&_a]:pointer-events-none [&_a]:text-inherit [&_a]:no-underline [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4">
            <Markdown skipHtml>{message.content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

export function AssistantChat({
  conversationId,
  onConversationCreated,
  variant = "page",
}: {
  conversationId: string | null;
  onConversationCreated?: (id: string) => void;
  variant?: "page" | "panel";
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const messagesQuery = useAssistantMessages(conversationId);
  const { send, retry, pending, failed } = useSendAssistantMessage(conversationId);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId, send.isSuccess]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  function autoResize() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  useEffect(() => {
    autoResize();
  }, [draft]);

  function submit() {
    const content = draft.trim();
    if (!content || send.isPending) return;
    setDraft("");
    send.mutate(content, {
      onSuccess: (result) => {
        if (!conversationId && onConversationCreated) onConversationCreated(result.conversationId);
      },
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={`min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-3 ${
          variant === "page" ? "md:px-4" : ""
        }`}
      >
        {messagesQuery.isPending ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messagesQuery.isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            {t("assistant.loadError")}
          </p>
        ) : messages.length === 0 && !pending ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Bot className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("assistant.empty")}</p>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {pending ? (
              <>
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    <p className="whitespace-pre-wrap">{pending.userContent}</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              </>
            ) : null}
            {failed ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
                <span>{t("assistant.sendError")}</span>
                {conversationId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate()}
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    {t("assistant.retry")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={draft}
            maxLength={MAX_INPUT_LENGTH}
            placeholder={t("assistant.placeholder")}
            aria-label={t("assistant.placeholder")}
            className="max-h-32 min-h-10 flex-1 resize-none"
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button
            size="icon"
            aria-label={t("assistant.send")}
            disabled={!draft.trim() || send.isPending}
            onClick={submit}
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizonal className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{t("assistant.disclaimer")}</p>
      </div>
    </div>
  );
}
