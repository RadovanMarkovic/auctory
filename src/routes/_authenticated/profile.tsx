import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ErrorState, LoadingState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

const title = "Your Profile — Auctory";
const description =
  "Manage your Auctory profile: personal details, contact data, avatar, and wallet connection status.";

export const Route = createFileRoute("/_authenticated/profile")({
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
  component: ProfilePage,
});

function initialsOf(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "A").concat(parts[1]?.[0] ?? "").toUpperCase();
}

function shortenAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  async function onSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }


  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const [{ data: profile, error }, { data: roles, error: rolesError }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "full_name, avatar_url, phone, country, account_status, created_at, wallet_address, wallet_network, wallet_verified_at",
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      if (error) throw error;
      if (rolesError) throw rolesError;
      return { profile, roles: (roles ?? []).map((r) => r.role) };
    },
  });

  const profile = profileQuery.data?.profile ?? null;
  const avatarPath = profile?.avatar_url ?? null;

  const avatarUrlQuery = useQuery({
    queryKey: ["avatar-url", avatarPath],
    enabled: Boolean(avatarPath),
    queryFn: async () => {
      if (!avatarPath) return null;
      if (/^https?:\/\//.test(avatarPath)) return avatarPath;
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrl(avatarPath, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setCountry(profile.country ?? "");
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          country: country.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("account.profile.saved"));
      void queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: () => toast.error(t("auth.errors.generic")),
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) throw new Error("type");
      if (file.size > 5 * 1024 * 1024) throw new Error("size");
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("profilePage.avatar.updated"));
      void queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (error: Error) => {
      if (error.message === "type") toast.error(t("profilePage.avatar.invalidType"));
      else if (error.message === "size") toast.error(t("profilePage.avatar.tooLarge"));
      else toast.error(t("auth.errors.generic"));
    },
  });

  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      if (avatarPath && !/^https?:\/\//.test(avatarPath)) {
        await supabase.storage.from("avatars").remove([avatarPath]);
      }
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("profilePage.avatar.removed"));
      void queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: () => toast.error(t("auth.errors.generic")),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (fullName.trim().length > 0 && fullName.trim().length < 2) {
      toast.error(t("auth.validation.nameRequired"));
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (phone.trim().length > 0 && (digits.length < 6 || digits.length > 20)) {
      toast.error(t("auth.validation.phoneInvalid"));
      return;
    }
    saveMutation.mutate();
  }

  const walletConnected = Boolean(profile?.wallet_address);
  const dateFormatter = new Intl.DateTimeFormat(i18n.language === "sr" ? "sr-RS" : "en-GB", {
    dateStyle: "medium",
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("profilePage.eyebrow")}
        title={t("profilePage.title")}
        description={t("profilePage.description")}
      />

      {profileQuery.isLoading ? (
        <div className="mt-12">
          <LoadingState />
        </div>
      ) : profileQuery.isError ? (
        <div className="mt-12">
          <ErrorState
            title={t("common.errorTitle")}
            description={t("common.errorDescription")}
            onRetry={() => void profileQuery.refetch()}
            retryLabel={t("common.retry")}
          />
        </div>
      ) : (
        <div className="mt-12 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-3xl">
                  {t("profilePage.avatar.title")}
                </CardTitle>
                <CardDescription>{t("profilePage.avatar.description")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-6">
                <Avatar className="size-20">
                  {avatarUrlQuery.data ? (
                    <AvatarImage src={avatarUrlQuery.data} alt={t("profilePage.avatar.alt")} />
                  ) : null}
                  <AvatarFallback className="text-lg">
                    {initialsOf(fullName, user?.email ?? "")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-wrap gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) avatarMutation.mutate(file);
                      event.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={avatarMutation.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {avatarMutation.isPending
                      ? t("common.loading")
                      : t("profilePage.avatar.upload")}
                  </Button>
                  {avatarPath ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={removeAvatarMutation.isPending}
                      onClick={() => removeAvatarMutation.mutate()}
                    >
                      {t("profilePage.avatar.remove")}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-3xl">
                  {t("profilePage.personal.title")}
                </CardTitle>
                <CardDescription>{t("profilePage.personal.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={onSubmit} noValidate>
                  <div>
                    <Label htmlFor="profile-name">{t("auth.fields.fullName")}</Label>
                    <Input
                      id="profile-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="profile-email">{t("auth.fields.email")}</Label>
                    <Input id="profile-email" value={user?.email ?? ""} readOnly className="mt-2" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("profilePage.contact.emailHint")}
                    </p>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="profile-phone">{t("auth.fields.phone")}</Label>
                      <Input
                        id="profile-phone"
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^+\d\s()-]/g, ""))}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="profile-country">{t("auth.fields.country")}</Label>
                      <Select value={country} onValueChange={setCountry}>
                        <SelectTrigger
                          id="profile-country"
                          className="mt-2"
                          aria-label={t("auth.fields.country")}
                        >
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
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-2xl">
                  {t("profilePage.wallet.title")}
                </CardTitle>
                <CardDescription>{t("profilePage.wallet.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("profilePage.wallet.status")}</span>
                  <Badge variant={walletConnected ? "success" : "muted"}>
                    {walletConnected
                      ? t("profilePage.wallet.connected")
                      : t("profilePage.wallet.notConnected")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("profilePage.wallet.address")}</span>
                  <span className="font-mono text-xs">
                    {profile?.wallet_address
                      ? shortenAddress(profile.wallet_address)
                      : t("profilePage.wallet.none")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("profilePage.wallet.network")}</span>
                  <span>{profile?.wallet_network ?? t("profilePage.wallet.none")}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("profilePage.wallet.verifiedAt")}</span>
                  <span>
                    {profile?.wallet_verified_at
                      ? dateFormatter.format(new Date(profile.wallet_verified_at))
                      : t("profilePage.wallet.none")}
                  </span>
                </div>
                <Button variant="outline" className="w-full" disabled>
                  {t("profilePage.wallet.connectSoon")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("profilePage.wallet.hint")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-2xl">{t("account.status.title")}</CardTitle>
                <CardDescription>{t("profilePage.status.readOnly")}</CardDescription>
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
                  <span>{t(`account.statuses.${profile?.account_status ?? "active"}`)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("account.status.emailVerified")}</span>
                  <span>{user?.email_confirmed_at ? t("account.status.yes") : t("account.status.no")}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("profilePage.status.memberSince")}</span>
                  <span>
                    {profile?.created_at ? dateFormatter.format(new Date(profile.created_at)) : "—"}
                  </span>
                </div>
                <Button variant="outline" className="w-full" onClick={() => void onSignOut()}>
                  {t("account.signOut")}
                </Button>
              </CardContent>

            </Card>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
