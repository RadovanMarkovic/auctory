/**
 * Client hooks for the assistant. Model access happens only in server functions.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  deleteConversation,
  getConversation,
  listConversations,
  retryAssistantMessage,
  sendAssistantMessage,
  type ConversationMessageDto,
  type ConversationSummary,
} from "@/lib/assistant.functions";

export type { ConversationMessageDto, ConversationSummary };

export interface PendingTurn {
  userContent: string;
}

export function useAssistantConversations(enabled: boolean) {
  const fn = useServerFn(listConversations);
  return useQuery({
    queryKey: ["assistant-conversations"],
    enabled,
    queryFn: () => fn(),
  });
}

export function useAssistantMessages(conversationId: string | null) {
  const fn = useServerFn(getConversation);
  return useQuery({
    queryKey: ["assistant-messages", conversationId],
    enabled: Boolean(conversationId),
    queryFn: () => fn({ data: { conversationId: conversationId! } }),
  });
}

export function useDeleteConversation() {
  const fn = useServerFn(deleteConversation);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => fn({ data: { conversationId } }),
    onSuccess: (_r, conversationId) => {
      void queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["assistant-messages", conversationId] });
    },
  });
}

/**
 * Send a message with optimistic UI: the user message appears immediately,
 * with a typing indicator until the assistant reply resolves. Retries are
 * idempotent server-side via a client request id.
 */
export function useSendAssistantMessage(conversationId: string | null) {
  const fn = useServerFn(sendAssistantMessage);
  const retryFn = useServerFn(retryAssistantMessage);
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingTurn | null>(null);
  const [failed, setFailed] = useState<PendingTurn | null>(null);

  const send = useMutation({
    mutationFn: async (content: string) => {
      const clientRequestId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setPending({ userContent: content });
      setFailed(null);
      return fn({ data: { conversationId: conversationId ?? undefined, content, clientRequestId } });
    },
    onSuccess: (result) => {
      setPending(null);
      setFailed(null);
      void queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] });
      void queryClient.invalidateQueries({
        queryKey: ["assistant-messages", result.conversationId],
      });
    },
    onError: (_e, content) => {
      setPending(null);
      setFailed({ userContent: content });
    },
  });

  const retry = useMutation({
    mutationFn: async () => {
      if (!conversationId) throw new Error("no conversation");
      setPending(failed);
      setFailed(null);
      return retryFn({ data: { conversationId } });
    },
    onSuccess: () => {
      setPending(null);
      void queryClient.invalidateQueries({
        queryKey: ["assistant-messages", conversationId],
      });
    },
    onError: () => {
      setPending(null);
      if (failed) setFailed(failed);
    },
  });

  return { send, retry, pending, failed };
}
