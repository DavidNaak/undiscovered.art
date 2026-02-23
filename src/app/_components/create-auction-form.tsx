"use client";

import { useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";

import {
  MAX_UPLOAD_FILE_BYTES,
  createArtworkUploadSchema,
  createAuctionFormSchema,
  datetimeLocalToDate,
  dollarsToCents,
  isAllowedImageMimeType,
} from "~/lib/auctions/schema";
import { api } from "~/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AuctionFormValues = {
  title: string;
  description: string;
  startPrice: string;
  minIncrement: string;
  endsAt: string;
  imageFile: File | null;
};

function toFieldError(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Invalid value";
}

export function CreateAuctionForm({ canCreate }: { canCreate: boolean }) {
  const utils = api.useUtils();
  const createAuction = api.auction.create.useMutation({
    onSuccess: async () => {
      await utils.auction.listOpen.invalidate();
    },
  });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const minEndAt = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    return now.toISOString().slice(0, 16);
  }, []);

  const defaultValues: AuctionFormValues = {
    title: "",
    description: "",
    startPrice: "100",
    minIncrement: "10",
    endsAt: "",
    imageFile: null,
  };

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      setSubmitSuccess(null);

      const parsedForm = createAuctionFormSchema.safeParse({
        title: value.title,
        description: value.description,
        startPrice: value.startPrice,
        minIncrement: value.minIncrement,
        endsAt: value.endsAt,
      });
      if (!parsedForm.success) {
        setSubmitError(parsedForm.error.issues[0]?.message ?? "Fix form errors");
        return;
      }

      if (!value.imageFile) {
        setSubmitError("Artwork image is required");
        return;
      }
      if (!isAllowedImageMimeType(value.imageFile.type)) {
        setSubmitError("Only jpeg, png, webp, and gif files are supported");
        return;
      }
      if (value.imageFile.size > MAX_UPLOAD_FILE_BYTES) {
        setSubmitError("Image is too large. Max size is 5MB");
        return;
      }

      const endsAtDate = datetimeLocalToDate(parsedForm.data.endsAt);
      if (!endsAtDate) {
        setSubmitError("Invalid end time");
        return;
      }

      const parsedUploadRequest = createArtworkUploadSchema.safeParse({
        fileName: value.imageFile.name,
        fileType: value.imageFile.type,
        fileSize: value.imageFile.size,
      });
      if (!parsedUploadRequest.success) {
        setSubmitError(parsedUploadRequest.error.issues[0]?.message ?? "Invalid image");
        return;
      }

      try {
        const uploadInitResponse = await fetch("/api/uploads/artwork", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(parsedUploadRequest.data),
        });
        const uploadInitJson = (await uploadInitResponse.json()) as {
          imagePath?: string;
          signedUrl?: string;
          error?: string;
        };
        if (
          !uploadInitResponse.ok ||
          !uploadInitJson.imagePath ||
          !uploadInitJson.signedUrl
        ) {
          setSubmitError(uploadInitJson.error ?? "Could not prepare image upload");
          return;
        }

        const uploadResponse = await fetch(uploadInitJson.signedUrl, {
          method: "PUT",
          headers: {
            "cache-control": "max-age=3600",
            "content-type": value.imageFile.type,
            "x-upsert": "false",
          },
          body: value.imageFile,
        });
        if (!uploadResponse.ok) {
          setSubmitError("Image upload failed. Please try again.");
          return;
        }

        await createAuction.mutateAsync({
          title: parsedForm.data.title,
          description: parsedForm.data.description?.trim() ?? undefined,
          imagePath: uploadInitJson.imagePath,
          startPriceCents: dollarsToCents(parsedForm.data.startPrice),
          minIncrementCents: dollarsToCents(parsedForm.data.minIncrement),
          endsAt: endsAtDate,
        });
        setSubmitSuccess("Auction created.");
        form.reset();
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Could not create auction. Try again.",
        );
      }
    },
  });

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
        <CardDescription>Upload one artwork image and launch an auction.</CardDescription>
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
              <div className="space-y-2">
                <Label htmlFor={field.name}>Title</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Evening Glow, 2026"
                />
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                  <p className="text-sm text-red-500">
                    {toFieldError(field.state.meta.errors[0])}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Description</Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Medium, dimensions, and story behind the piece."
                  rows={4}
                />
              </div>
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
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Start Price (USD)</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="100.00"
                    inputMode="decimal"
                  />
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                    <p className="text-sm text-red-500">
                      {toFieldError(field.state.meta.errors[0])}
                    </p>
                  ) : null}
                </div>
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
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Min Increment (USD)</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="10.00"
                    inputMode="decimal"
                  />
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                    <p className="text-sm text-red-500">
                      {toFieldError(field.state.meta.errors[0])}
                    </p>
                  ) : null}
                </div>
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
              <div className="space-y-2">
                <Label htmlFor={field.name}>Auction Ends At</Label>
                <Input
                  id={field.name}
                  type="datetime-local"
                  value={field.state.value}
                  min={minEndAt}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                  <p className="text-sm text-red-500">
                    {toFieldError(field.state.meta.errors[0])}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Field
            name="imageFile"
            validators={{
              onBlur: ({ value }) => {
                if (!value) return "Artwork image is required";
                if (!isAllowedImageMimeType(value.type)) {
                  return "Only jpeg, png, webp, and gif files are supported";
                }
                if (value.size > MAX_UPLOAD_FILE_BYTES) {
                  return "Image is too large. Max size is 5MB";
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Artwork Image</Label>
                <input
                  id={field.name}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="block w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:font-medium"
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.files?.[0] ?? null)}
                />
                {field.state.value ? (
                  <p className="text-xs text-muted-foreground">{field.state.value.name}</p>
                ) : null}
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                  <p className="text-sm text-red-500">
                    {toFieldError(field.state.meta.errors[0])}
                  </p>
                ) : null}
              </div>
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

          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                className="w-full"
                disabled={
                  !(canSubmit ?? false) ||
                  (isSubmitting ?? false) ||
                  createAuction.isPending
                }
              >
                {(isSubmitting ?? false) || createAuction.isPending
                  ? "Creating..."
                  : "Create Auction"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
