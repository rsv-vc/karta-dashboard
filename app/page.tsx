import { redirect } from "next/navigation";

// proxy.ts normally handles "/"; this is a fallback for when it does not run.
export default function Home() {
  redirect("/dashboard");
}
