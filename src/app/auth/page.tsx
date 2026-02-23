"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "~/server/better-auth/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "signIn" | "signUp";

type SeedUsersResponse = {
  created?: Array<{
    name: string;
    email: string;
    password: string;
  }>;
  error?: string;
};

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seededUsers, setSeededUsers] = useState<SeedUsersResponse["created"]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "signUp") {
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
          callbackURL: "/",
        });

        if (result.error) {
          setErrorMessage(result.error.message ?? "Sign up failed");
          return;
        }

        setSuccessMessage("Account created. You are now signed in.");
        router.push("/");
        router.refresh();
        return;
      }

      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
        callbackURL: "/",
      });

      if (result.error) {
        setErrorMessage(result.error.message ?? "Sign in failed");
        return;
      }

      setSuccessMessage("Signed in.");
      router.push("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Auth request failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSeedUsers() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSeeding(true);

    try {
      const response = await fetch("/api/dev/seed-users", {
        method: "POST",
      });
      const json = (await response.json()) as SeedUsersResponse;

      if (!response.ok) {
        setErrorMessage(json.error ?? "Could not create demo users.");
        setSeededUsers([]);
        return;
      }

      setSeededUsers(json.created ?? []);
      setSuccessMessage("Created 5 demo users.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not create demo users.",
      );
      setSeededUsers([]);
    } finally {
      setIsSeeding(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-100 to-amber-50/80 p-6 text-zinc-900">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Email Auth (MVP)</h1>
          <Link
            href="/"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium transition hover:bg-zinc-100"
          >
            Back to auctions
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mode === "signIn" ? "Sign In" : "Create Account"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-2">
              <Button
                type="button"
                variant={mode === "signIn" ? "default" : "outline"}
                onClick={() => setMode("signIn")}
              >
                Sign In
              </Button>
              <Button
                type="button"
                variant={mode === "signUp" ? "default" : "outline"}
                onClick={() => setMode("signUp")}
              >
                Sign Up
              </Button>
            </div>

            <form className="space-y-4" onSubmit={handleAuthSubmit}>
              {mode === "signUp" ? (
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Demo User"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="demo@example.com"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting
                  ? mode === "signIn"
                    ? "Signing in..."
                    : "Creating account..."
                  : mode === "signIn"
                    ? "Sign In"
                    : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-medium text-zinc-800">Bulk Demo Users (5)</p>
              <p className="text-xs text-zinc-600">
                Creates exactly 5 demo email/password users in development.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleSeedUsers}
                disabled={isSeeding}
              >
                {isSeeding ? "Creating 5 users..." : "Create 5 Demo Users"}
              </Button>
              {seededUsers && seededUsers.length > 0 ? (
                <div className="rounded border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
                  {seededUsers.map((user) => (
                    <p key={user.email}>
                      {user.email} / {user.password}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            {errorMessage ? (
              <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}
            {successMessage ? (
              <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {successMessage}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
