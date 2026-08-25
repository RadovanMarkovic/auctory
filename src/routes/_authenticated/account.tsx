import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ErrorState, LoadingState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { COUNTRIES } from "@/lib/countries";

const title = "Your Account — Auctory";
const description = "Manage your Auctory profile, bids, listings, and wallet connection.";

export const Route = createFileRoute("/_authenticated/account")({
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
  component: AccountPage,
});

function AccountPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const [{ data: profile, error }, { data: roles, error: rolesError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_url, phone, country, account_status, created_at")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      if (error) throw error;
      if (rolesError) throw rolesError;
      return { profile, roles: (roles ?? []).map((r) => r.role) };
    },
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    const profile = profileQuery.data?.profile;
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setCountry(profile.country ?? "");
  }, [profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          country: country.trim() || null,
        })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("account.profile.saved"));
      void queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: () => toast.error(t("auth.errors.generic")),
  });

  async function onSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (fullName.trim().length > 0 && fullName.trim().length < 2) {
      toast.error(t("auth.validation.nameRequired"));
      return;
    }
    saveMutation.mutate();
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("pages.account.eyebrow")}
        title={t("pages.account.title")}
        description={t("pages.account.description")}
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-3xl">{t("account.profile.title")}</CardTitle>
            <CardDescription>{t("account.profile.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {profileQuery.isLoading ? (
              <LoadingState />
            ) : profileQuery.isError ? (
              <ErrorState
                title={t("common.errorTitle")}
                description={t("common.errorDescription")}
                onRetry={() => void profileQuery.refetch()}
                retryLabel={t("common.retry")}
              />
            ) : (
              <form className="space-y-5" onSubmit={onSubmit} noValidate>
                <div>
                  <Label htmlFor="account-email">{t("auth.fields.email")}</Label>
                  <Input id="account-email" value={user?.email ?? ""} readOnly className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="account-name">{t("auth.fields.fullName")}</Label>
                  <Input
                    id="account-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="account-phone">{t("auth.fields.phone")}</Label>
                    <Input
                      id="account-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="account-country">{t("auth.fields.country")}</Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger id="account-country" className="mt-2" aria-label={t("auth.fields.country")}>
                        <SelectValue placeholder={t("auth.fields.countryPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? t("common.loading") : t("account.profile.save")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">{t("account.status.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{t("account.status.role")}</span>
              <span className="flex gap-2">
                {(profileQuery.data?.roles ?? []).map((role) => (
                  <Badge key={role} variant="gold">
                    {t(`account.roles.${role}`)}
                  </Badge>
                ))}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{t("account.status.accountStatus")}</span>
              <span>{t(`account.statuses.${profileQuery.data?.profile?.account_status ?? "active"}`)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{t("account.status.emailVerified")}</span>
              <span>
                {user?.email_confirmed_at ? t("account.status.yes") : t("account.status.no")}
              </span>
            </div>
            <Button variant="outline" className="w-full" onClick={onSignOut}>
              {t("account.signOut")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
