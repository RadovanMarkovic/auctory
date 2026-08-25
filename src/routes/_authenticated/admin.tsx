import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/use-roles";
import type { Database } from "@/integrations/supabase/types";

const title = "Admin — Auctory";
const description = "Manage Auctory users, roles, and seller requests.";

type SellerStatus = Database["public"]["Enums"]["seller_request_status"];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function statusVariant(status: SellerStatus) {
  if (status === "approved") return "success" as const;
  if (status === "pending") return "gold" as const;
  return "muted" as const;
}

function AdminPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: rolesLoading } = useRoles();

  useEffect(() => {
    if (!rolesLoading && !isAdmin) {
      void navigate({ to: "/profile", replace: true });
    }
  }, [rolesLoading, isAdmin, navigate]);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return data ?? [];
    },
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  }

  const setStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: SellerStatus }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ seller_request_status: status })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.toast.updated"));
      invalidate();
    },
    onError: () => toast.error(t("auth.errors.generic")),
  });

  const grantSeller = useMutation({
    mutationFn: async ({ userId, approve }: { userId: string; approve: boolean }) => {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: "seller" }, { onConflict: "user_id,role" });
      if (error) throw error;
      if (approve) {
        const { error: statusError } = await supabase
          .from("profiles")
          .update({ seller_request_status: "approved" })
          .eq("id", userId);
        if (statusError) throw statusError;
      }
    },
    onSuccess: () => {
      toast.success(t("admin.toast.sellerGranted"));
      invalidate();
    },
    onError: () => toast.error(t("auth.errors.generic")),
  });

  const revokeSeller = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "seller");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.toast.sellerRevoked"));
      invalidate();
    },
    onError: () => toast.error(t("auth.errors.generic")),
  });

  const busy = setStatus.isPending || grantSeller.isPending || revokeSeller.isPending;

  if (rolesLoading || !isAdmin) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("admin.eyebrow")}
        title={t("admin.title")}
        description={t("admin.description")}
      />

      <div className="mt-12">
        {usersQuery.isLoading ? (
          <LoadingState />
        ) : usersQuery.isError ? (
          <ErrorState
            title={t("common.errorTitle")}
            description={t("common.errorDescription")}
            onRetry={() => void usersQuery.refetch()}
            retryLabel={t("common.retry")}
          />
        ) : (usersQuery.data ?? []).length === 0 ? (
          <EmptyState title={t("admin.empty.title")} description={t("admin.empty.description")} />
        ) : (
          <div className="space-y-4">
            {(usersQuery.data ?? []).map((row) => {
              const roles = row.roles ?? [];
              const isSeller = roles.includes("seller");
              const pending = row.seller_request_status === "pending";
              return (
                <Card key={row.id}>
                  <CardHeader>
                    <CardTitle className="font-display text-2xl">
                      {row.full_name || row.email}
                    </CardTitle>
                    <CardDescription>{row.email}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">{t("admin.table.roles")}</span>
                        {roles.length === 0 ? (
                          <span>—</span>
                        ) : (
                          roles.map((role) => (
                            <Badge key={role} variant="gold">
                              {t(`account.roles.${role}`)}
                            </Badge>
                          ))
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">{t("admin.table.request")}</span>
                        <Badge variant={statusVariant(row.seller_request_status)}>
                          {t(`seller.status.${row.seller_request_status}`)}
                        </Badge>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        size="sm"
                        disabled={busy || !pending}
                        onClick={() => grantSeller.mutate({ userId: row.id, approve: true })}
                      >
                        {t("admin.actions.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || !pending}
                        onClick={() => setStatus.mutate({ userId: row.id, status: "rejected" })}
                      >
                        {t("admin.actions.reject")}
                      </Button>
                      {isSeller ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => revokeSeller.mutate(row.id)}
                        >
                          {t("admin.actions.removeSeller")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => grantSeller.mutate({ userId: row.id, approve: false })}
                        >
                          {t("admin.actions.addSeller")}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
