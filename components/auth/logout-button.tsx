import { LogOutIcon } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="outline">
        <LogOutIcon />
        Log out
      </Button>
    </form>
  );
}
