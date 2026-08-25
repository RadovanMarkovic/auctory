import { UserRound } from "lucide-react";

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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu">
          <UserRound />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="eyebrow">Account</DropdownMenuLabel>
        <DropdownMenuItem disabled>Sign in</DropdownMenuItem>
        <DropdownMenuItem disabled>Create account</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>My bids</DropdownMenuItem>
        <DropdownMenuItem disabled>My listings</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
