"use client";

import type { ComponentProps, FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "~/server/better-auth/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type AuthMode = "signIn" | "signUp";

export function LoginForm({
  className,
  initialMode = "signIn",
  ...props
}: ComponentProps<"div"> & { initialMode?: AuthMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
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
          setErrorMessage(result.error.message ?? "Could not create account.");
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
        setErrorMessage(result.error.message ?? "Sign in failed.");
        return;
      }

      setSuccessMessage("Signed in.");
      router.push("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Auth request failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGitHubSignIn() {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: "/",
        requestSignUp: mode === "signUp",
      });

      if (result.error) {
        setErrorMessage(result.error.message ?? "Could not continue with GitHub.");
        return;
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not continue with GitHub.",
      );
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {mode === "signIn" ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {mode === "signIn"
              ? "Sign in with GitHub or use email and password."
              : "Sign up with GitHub or use email and password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailSubmit}>
            <FieldGroup>
              <Field>
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleGitHubSignIn}
                  disabled={isSubmitting}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.1.82-.26.82-.58 0-.28-.02-1.22-.02-2.22-3.34.72-4.04-1.42-4.04-1.42-.54-1.4-1.34-1.76-1.34-1.76-1.1-.74.08-.74.08-.74 1.2.08 1.84 1.26 1.84 1.26 1.08 1.82 2.8 1.3 3.5 1 .1-.78.42-1.3.76-1.6-2.66-.3-5.46-1.34-5.46-5.92 0-1.32.46-2.4 1.24-3.24-.12-.3-.54-1.54.12-3.2 0 0 1-.32 3.3 1.24.96-.26 1.98-.38 3-.38s2.04.12 3 .38c2.3-1.56 3.3-1.24 3.3-1.24.66 1.66.24 2.9.12 3.2.78.84 1.24 1.92 1.24 3.24 0 4.6-2.82 5.62-5.5 5.92.44.38.82 1.1.82 2.24 0 1.62-.02 2.92-.02 3.32 0 .32.22.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"
                      fill="currentColor"
                    />
                  </svg>
                  Continue with GitHub
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>

              {mode === "signUp" ? (
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Demo User"
                    required
                    disabled={isSubmitting}
                  />
                </Field>
              ) : null}

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="m@example.com"
                  required
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </Field>

              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? mode === "signIn"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "signIn"
                      ? "Sign in"
                      : "Create account"}
                </Button>
                <FieldDescription className="text-center">
                  {mode === "signIn" ? "Need an account?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    className="font-medium underline underline-offset-4"
                    onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
                  >
                    {mode === "signIn" ? "Sign up" : "Sign in"}
                  </button>
                </FieldDescription>
              </Field>

              {errorMessage ? (
                <FieldDescription className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700">
                  {errorMessage}
                </FieldDescription>
              ) : null}
              {successMessage ? (
                <FieldDescription className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-700">
                  {successMessage}
                </FieldDescription>
              ) : null}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By continuing, you agree to the platform terms and privacy policy.
      </FieldDescription>
    </div>
  );
}
