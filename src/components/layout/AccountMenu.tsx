import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/use-roles";

export function AccountMenu() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin } = useRoles();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function onSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("account.menu")}>
          <UserRound />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {user ? (
          <>
            <DropdownMenuLabel className="eyebrow">{t("account.signedInAs")}</DropdownMenuLabel>
            <DropdownMenuLabel className="truncate pt-0 text-sm font-normal">
              {user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">{t("account.myProfile")}</Link>
            </DropdownMenuItem>
            {isAdmin ? (
              <DropdownMenuItem asChild>
                <Link to="/admin">{t("admin.nav")}</Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void onSignOut()}>
              {t("account.signOut")}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel className="eyebrow">{t("account.label")}</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link to="/auth">{t("account.signIn")}</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
