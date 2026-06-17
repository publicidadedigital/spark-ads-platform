import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin.server";

export const checkEmailExists = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ email: z.string().trim().email() }).parse(input))
  .handler(async ({ data }) => {
    const admin = getAdminClient();
    const normalizedEmail = data.email.toLowerCase();
    let page = 1;

    while (page <= 10) {
      const { data: result, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);

      const match = result.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
      if (match) return { exists: true };

      if (result.users.length < 1000) break;
      page += 1;
    }

    return { exists: false };
  });
