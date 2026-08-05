import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

import { apiFetch } from "@/lib/api-client";

/**
 * All Better Auth traffic goes through POST /i/api (Protobuf).
 * Logical paths remain /api/auth/* inside the envelope only.
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: {
    customFetchImpl: (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      return apiFetch(url, init);
    },
  },
  plugins: [usernameClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
