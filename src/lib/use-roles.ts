import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

/** Roles of the currently signed-in user. Roles are always verified server-side by RLS. */
export function useRoles() {
  const { user } = useAuth();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["user-roles", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<AppRole[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((row) => row.role);
    },
  });

  const roles = query.data ?? [];
  return {
    roles,
    isLoading: query.isLoading,
    isAdmin: roles.includes("admin"),
    isSeller: roles.includes("seller"),
  };
}
