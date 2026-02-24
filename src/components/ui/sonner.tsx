"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

import { cn } from "@/lib/utils";

export function Toaster({ className, toastOptions, ...props }: ToasterProps) {
  return (
    <Sonner
      closeButton
      expand={false}
      position="top-right"
      richColors
      className={cn("toaster group", className)}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card/95 group-[.toaster]:text-card-foreground group-[.toaster]:border-border/80 group-[.toaster]:shadow-xl group-[.toaster]:rounded-2xl group-[.toaster]:backdrop-blur-md",
          title: "text-sm font-semibold tracking-tight",
          description: "text-muted-foreground text-xs",
          actionButton:
            "group-[.toast]:bg-foreground group-[.toast]:text-background group-[.toast]:rounded-full group-[.toast]:px-4 group-[.toast]:text-xs group-[.toast]:font-semibold",
          cancelButton:
            "group-[.toast]:bg-secondary group-[.toast]:text-secondary-foreground group-[.toast]:rounded-full group-[.toast]:px-4 group-[.toast]:text-xs",
          closeButton:
            "group-[.toast]:border-border/80 group-[.toast]:bg-background/80 group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:!border-emerald-200 group-[.toaster]:!bg-emerald-50/95 group-[.toaster]:!text-emerald-900",
          error:
            "group-[.toaster]:!border-red-200 group-[.toaster]:!bg-red-50/95 group-[.toaster]:!text-red-900",
        },
        ...toastOptions,
      }}
      {...props}
    />
  );
}
