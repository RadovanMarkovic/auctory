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

/** Placeholder: authentication is not implemented yet. */
export function AccountMenu() {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("account.menu")}>
          <UserRound />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="eyebrow">{t("account.label")}</DropdownMenuLabel>
        <DropdownMenuItem disabled>{t("account.signIn")}</DropdownMenuItem>
        <DropdownMenuItem disabled>{t("account.createAccount")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>{t("account.myBids")}</DropdownMenuItem>
        <DropdownMenuItem disabled>{t("account.myListings")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
