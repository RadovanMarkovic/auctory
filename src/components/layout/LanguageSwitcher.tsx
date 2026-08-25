import { Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Placeholder: i18n is not wired yet, the switcher only presents the locales. */
export function LanguageSwitcher() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Change language">
          <Globe />
          <span className="hidden sm:inline">EN</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="eyebrow">Language</DropdownMenuLabel>
        <DropdownMenuItem disabled>English</DropdownMenuItem>
        <DropdownMenuItem disabled>Srpski</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
