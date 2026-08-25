import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Placeholder: wallet connection (Sepolia) is not implemented yet. */
export function WalletButton({ className }: { className?: string }) {
  return (
    <Button variant="outlineGold" size="sm" className={className} disabled>
      <Wallet />
      Connect wallet
    </Button>
  );
}
