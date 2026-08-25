import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { RequiredMark } from "@/components/ui/required-mark";

const title = "Reset your password — Auctory";
const description = "Request a secure password reset link for your Auctory account.";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError(t("auth.validation.emailInvalid"));
      return;
    }
    setError(null);
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (resetError) {
      toast.error(t("auth.errors.generic"));
      return;
    }
    setSent(true);
    toast.success(t("auth.forgot.sent"));
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-md py-10">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-3xl">{t("auth.forgot.title")}</CardTitle>
            <CardDescription>
              {sent ? t("auth.forgot.sentDescription", { email }) : t("auth.forgot.description")}
            </CardDescription>
          </CardHeader>
          {!sent ? (
            <CardContent>
              <form className="space-y-5" onSubmit={onSubmit} noValidate>
                <div>
                  <Label htmlFor="forgot-email">{t("auth.fields.email")}<RequiredMark /></Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-2"
                  />
                  {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? t("common.loading") : t("auth.forgot.submit")}
                </Button>
                <Link
                  to="/auth"
                  className="block text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t("auth.forgot.backToSignIn")}
                </Link>
              </form>
            </CardContent>
          ) : null}
        </Card>
      </div>
    </PageContainer>
  );
}
