"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const supabase = createClient();
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    setSubmitting(false);

    if (error) {
      toast.error("Couldn't send the link", { description: error.message });
      return;
    }

    setSent(true);
    toast.success("Check your inbox", {
      description: `We sent a sign-in link to ${email}.`,
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-full bg-primary/10 p-3">
          <Mail className="size-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-medium">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            We sent a sign-in link to <span className="font-medium">{email}</span>.
            Click it to finish signing in.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSent(false)}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={submitting}
        />
      </div>
      <Button type="submit" disabled={submitting || !email}>
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Sending link…
          </>
        ) : (
          "Send sign-in link"
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        We&apos;ll email you a one-time link. No password needed.
      </p>
    </form>
  );
}
