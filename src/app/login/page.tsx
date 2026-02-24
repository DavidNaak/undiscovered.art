"use client";

import Link from "next/link";

import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-700">Undiscovered Art</p>
          <Link
            href="/"
            className="text-sm text-zinc-600 underline underline-offset-4 transition hover:text-zinc-900"
          >
            Back to auctions
          </Link>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
