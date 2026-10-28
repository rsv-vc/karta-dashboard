import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Ends the Supabase session and returns to the sign-in page. The DAL sends a
// session that belongs to no active team member here, so it cannot loop.
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
