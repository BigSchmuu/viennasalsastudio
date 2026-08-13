"use client";

import { useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await signOut();
      window.location.href = "/";
    } finally {
      setLoading(false);
    }
  }

  return (
    // action={signOut}: progressive-enhancement fallback so a pre-hydration
    // click still submits (button type="submit") instead of doing nothing —
    // see PROJ-2 QA BUG-1/BUG-2 follow-up. Once hydrated, onClick's
    // preventDefault takes over for the nicer loading-state UX.
    <form action={signOut}>
      <Button type="submit" variant="outline" onClick={handleLogout} disabled={loading}>
        {loading ? "Wird ausgeloggt…" : "Logout"}
      </Button>
    </form>
  );
}
