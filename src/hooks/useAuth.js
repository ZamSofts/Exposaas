import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";

export const useAuth = (roles = []) => {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== "loading" && !session?.user) {
      router.push("/");
      return;
    }
    if (roles.length > 0 && status !== "loading" && session?.user) {
      const hasRole = roles.includes(session.user.role);
      const hasPermission = session.user.permissions?.some(p => roles.includes(p));

      if (!hasRole && !hasPermission) {
        router.push("/");
        return;
      }
    }
  }, [status, session, router]);

  return { session: session?.user, status };
};
