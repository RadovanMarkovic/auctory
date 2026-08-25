import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { LoadingState } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountRedirect,
});

function AccountRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: "/profile", replace: true });
  }, [navigate]);

  return (
    <PageContainer>
      <LoadingState />
    </PageContainer>
  );
}
