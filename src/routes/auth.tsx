import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { COUNTRIES } from "@/lib/countries";

const title = "Sign in — Auctory";
const description = "Sign in or create your Auctory account to bid, sell, and track provenance.";

export const Route = createFileRoute("/auth")({
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
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},
  component: AuthPage,
});

function safePath(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const { session, loading } = useAuth();
  const target = safePath(search.redirect);

  useEffect(() => {
    if (!loading && session) void navigate({ to: target, replace: true });
  }, [loading, session, navigate, target]);

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-md py-10">
        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">{t("auth.signIn.tab")}</TabsTrigger>
            <TabsTrigger value="signup">{t("auth.signUp.tab")}</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <SignInCard onDone={() => navigate({ to: target, replace: true })} />
          </TabsContent>
          <TabsContent value="signup">
            <SignUpCard />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}

function useValidators() {
  const { t } = useTranslation();
  return {
    email: (value: string) => {
      if (!value.trim()) return t("auth.validation.emailRequired");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return t("auth.validation.emailInvalid");
      return null;
    },
    password: (value: string) => {
      if (!value) return t("auth.validation.passwordRequired");
      if (value.length < 8) return t("auth.validation.passwordShort");
      return null;
    },
    fullName: (value: string) => (value.trim().length < 2 ? t("auth.validation.nameRequired") : null),
    phone: (value: string) => {
      if (!value) return null;
      return /^[0-9]{6,20}$/.test(value) ? null : t("auth.validation.phoneInvalid");
    },
  };
}

function FieldError({ message }: { message?: string | null | undefined }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-destructive">{message}</p>;
}

function SignInCard({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const v = useValidators();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = { email: v.email(email), password: v.password(password) };
    setErrors(next);
    if (next.email || next.password) return;

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (error) {
      const message = /confirm/i.test(error.message)
        ? t("auth.errors.emailNotConfirmed")
        : t("auth.errors.invalidCredentials");
      toast.error(message);
      return;
    }
    toast.success(t("auth.signIn.success"));
    onDone();
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="font-display text-3xl">{t("auth.signIn.title")}</CardTitle>
        <CardDescription>{t("auth.signIn.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={onSubmit} noValidate>
          <div>
            <Label htmlFor="signin-email">{t("auth.fields.email")}</Label>
            <Input
              id="signin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2"
            />
            <FieldError message={errors["email"]} />
          </div>
          <div>
            <Label htmlFor="signin-password">{t("auth.fields.password")}</Label>
            <Input
              id="signin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2"
            />
            <FieldError message={errors["password"]} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? t("common.loading") : t("auth.signIn.submit")}
          </Button>
          <Link
            to="/forgot-password"
            className="block text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("auth.forgot.link")}
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}

function SignUpCard() {
  const { t } = useTranslation();
  const v = useValidators();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = {
      fullName: v.fullName(fullName),
      email: v.email(email),
      password: v.password(password),
      phone: v.phone(phone),
    };
    setErrors(next);
    if (next.fullName || next.email || next.password || next.phone) return;

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/account`,
        data: {
          full_name: fullName.trim(),
          phone: trimmedPhone,
          country: country.trim(),
        },
      },
    });
    setBusy(false);

    if (error) {
      toast.error(
        /registered|exists/i.test(error.message)
          ? t("auth.errors.emailTaken")
          : t("auth.errors.generic"),
      );
      return;
    }
    if (!data.session) {
      setSent(true);
      toast.success(t("auth.signUp.checkEmail"));
    }
  }

  if (sent) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-display text-3xl">{t("auth.signUp.verifyTitle")}</CardTitle>
          <CardDescription>{t("auth.signUp.verifyDescription", { email })}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="font-display text-3xl">{t("auth.signUp.title")}</CardTitle>
        <CardDescription>{t("auth.signUp.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={onSubmit} noValidate>
          <div>
            <Label htmlFor="signup-name">{t("auth.fields.fullName")}</Label>
            <Input
              id="signup-name"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-2"
            />
            <FieldError message={errors["fullName"]} />
          </div>
          <div>
            <Label htmlFor="signup-email">{t("auth.fields.email")}</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2"
            />
            <FieldError message={errors["email"]} />
          </div>
          <div>
            <Label htmlFor="signup-password">{t("auth.fields.password")}</Label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2"
            />
            <FieldError message={errors["password"]} />
            <p className="mt-1 text-xs text-muted-foreground">{t("auth.validation.passwordHint")}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="signup-phone">
                {t("auth.fields.phone")}{" "}
                <span className="text-xs text-muted-foreground">{t("auth.fields.optional")}</span>
              </Label>
              <Input
                id="signup-phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                className="mt-2"
              />
              <FieldError message={errors["phone"]} />
            </div>
            <div>
              <Label htmlFor="signup-country">
                {t("auth.fields.country")}{" "}
                <span className="text-xs text-muted-foreground">{t("auth.fields.optional")}</span>
              </Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id="signup-country" className="mt-2" aria-label={t("auth.fields.country")}>
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
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? t("common.loading") : t("auth.signUp.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
