import { redirect } from "next/navigation";

// The directory is now All leads (masked for sales agents).
export default function DirectoryPage() {
  redirect("/leads");
}
