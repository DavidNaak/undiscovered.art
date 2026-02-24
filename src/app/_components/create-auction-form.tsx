"use client";

import { useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";

import { createAuctionFormSchema } from "~/lib/auctions/schema";
import { api } from "~/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { submitCreateAuction } from "./create-auction-form.submit";
import {
  ArtworkFileFormField,
  TextInputFormField,
  TextareaFormField,
} from "./create-auction-form-fields";
import {
  DEFAULT_AUCTION_FORM_VALUES,
  type SubmitPhase,
  getSubmitLabel,
  toFieldError,
  validateArtworkFile,
} from "./create-auction-form.types";

export function CreateAuctionForm({ canCreate }: { canCreate: boolean }) {
  const utils = api.useUtils();
  const createAuction = api.auction.create.useMutation({
    onSuccess: async () => {
      await utils.auction.listOpen.invalidate();
    },
  });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const minEndAt = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    return now.toISOString().slice(0, 16);
  }, []);

  const form = useForm({
    defaultValues: DEFAULT_AUCTION_FORM_VALUES,
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      setSubmitSuccess(null);

      try {
        await submitCreateAuction({
          value,
          setSubmitPhase,
          createAuction: createAuction.mutateAsync,
        });

        setSubmitSuccess("Auction created.");
        form.reset();
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Could not create auction. Try again.",
        );
      } finally {
        setSubmitPhase("idle");
      }
    },
  });

  const isBusy = submitPhase !== "idle" || createAuction.isPending;

  if (!canCreate) {
    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Create Auction</CardTitle>
          <CardDescription>
            Sign in to list your artwork and start a timed auction.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Create Auction</CardTitle>
        <CardDescription>
          Upload one artwork image and launch an auction.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field
            name="title"
            validators={{
              onBlur: ({ value }) =>
                toFieldError(
                  createAuctionFormSchema.shape.title.safeParse(value).error?.issues[0]
                    ?.message,
                ),
            }}
          >
            {(field) => (
              <TextInputFormField
                field={field}
                label="Title"
                placeholder="Evening Glow, 2026"
                disabled={isBusy}
              />
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <TextareaFormField
                field={field}
                label="Description"
                placeholder="Medium, dimensions, and story behind the piece."
                disabled={isBusy}
                rows={4}
              />
            )}
          </form.Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field
              name="startPrice"
              validators={{
                onBlur: ({ value }) =>
                  toFieldError(
                    createAuctionFormSchema.shape.startPrice.safeParse(value).error
                      ?.issues[0]?.message,
                  ),
              }}
            >
              {(field) => (
                <TextInputFormField
                  field={field}
                  label="Start Price (USD)"
                  placeholder="100.00"
                  inputMode="decimal"
                  disabled={isBusy}
                />
              )}
            </form.Field>

            <form.Field
              name="minIncrement"
              validators={{
                onBlur: ({ value }) =>
                  toFieldError(
                    createAuctionFormSchema.shape.minIncrement.safeParse(value).error
                      ?.issues[0]?.message,
                  ),
              }}
            >
              {(field) => (
                <TextInputFormField
                  field={field}
                  label="Min Increment (USD)"
                  placeholder="10.00"
                  inputMode="decimal"
                  disabled={isBusy}
                />
              )}
            </form.Field>
          </div>

          <form.Field
            name="endsAt"
            validators={{
              onBlur: ({ value }) =>
                toFieldError(
                  createAuctionFormSchema.shape.endsAt.safeParse(value).error?.issues[0]
                    ?.message,
                ),
            }}
          >
            {(field) => (
              <TextInputFormField
                field={field}
                label="Auction Ends At"
                type="datetime-local"
                min={minEndAt}
                disabled={isBusy}
              />
            )}
          </form.Field>

          <form.Field
            name="imageFile"
            validators={{
              onChange: ({ value }) => validateArtworkFile(value),
              onBlur: ({ value }) => validateArtworkFile(value),
            }}
          >
            {(field) => (
              <ArtworkFileFormField
                field={field}
                disabled={isBusy}
                fileInputRef={fileInputRef}
              />
            )}
          </form.Field>

          {submitError ? (
            <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </p>
          ) : null}
          {submitSuccess ? (
            <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {submitSuccess}
            </p>
          ) : null}

          {isBusy ? (
            <p className="text-sm text-muted-foreground">{getSubmitLabel(submitPhase)}</p>
          ) : null}

          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([_, isSubmitting]) => (
              <Button
                type="submit"
                className="w-full"
                disabled={
                  (isSubmitting ?? false) || createAuction.isPending || isBusy
                }
              >
                {submitPhase !== "idle"
                  ? getSubmitLabel(submitPhase)
                  : (isSubmitting ?? false) || createAuction.isPending
                    ? "Validating..."
                    : "Create Auction"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
