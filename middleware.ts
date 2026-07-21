import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isPublicAppPath, loginRedirectPath } from "@/lib/auth/middleware";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { supabaseAnonKey, supabaseUrl } = getSupabasePublicConfig();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, options, value } of cookiesToSet) {
          request.cookies.set({ name, value, ...options });
        }
        response = NextResponse.next({ request });
        for (const { name, options, value } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicAppPath(request.nextUrl.pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = loginRedirectPath(request.nextUrl.pathname, request.nextUrl.search).slice(
      "/login".length,
    );
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
