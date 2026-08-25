import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const title = "Set a new password — Auctory";
const description = "Choose a new password for your Auctory account.";

export const Route = createFileRoute("/reset-password")({
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
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setReady(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = {
      password: password.length < 8 ? t("auth.validation.passwordShort") : null,
      confirm: password !== confirm ? t("auth.validation.passwordMismatch") : null,
    };
    setErrors(next);
    if (next.password || next.confirm) return;

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(t("auth.errors.generic"));
      return;
    }
    toast.success(t("auth.reset.success"));
    void navigate({ to: "/account", replace: true });
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-md py-10">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-3xl">{t("auth.reset.title")}</CardTitle>
            <CardDescription>
              {ready ? t("auth.reset.description") : t("auth.reset.invalidLink")}
            </CardDescription>
          </CardHeader>
          {ready ? (
            <CardContent>
              <form className="space-y-5" onSubmit={onSubmit} noValidate>
                <div>
                  <Label htmlFor="new-password">{t("auth.fields.newPassword")}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-2"
                  />
                  {errors["password"] ? (
                    <p className="mt-1 text-sm text-destructive">{errors["password"]}</p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="confirm-password">{t("auth.fields.confirmPassword")}</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="mt-2"
                  />
                  {errors["confirm"] ? (
                    <p className="mt-1 text-sm text-destructive">{errors["confirm"]}</p>
                  ) : null}
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? t("common.loading") : t("auth.reset.submit")}
                </Button>
              </form>
            </CardContent>
          ) : null}
        </Card>
      </div>
    </PageContainer>
  );
}
