"use client";

import { useMemo, useRef, useState } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

type SubmitPhase =
  | "idle"
  | "preparingUpload"
  | "uploadingImage"
  | "creatingAuction";

function toFieldError(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Invalid value";
}

function getSubmitLabel(phase: SubmitPhase): string {
  if (phase === "preparingUpload") return "Preparing upload...";
  if (phase === "uploadingImage") return "Uploading image...";
  if (phase === "creatingAuction") return "Creating auction...";
  return "Create Auction";
}

function validateArtworkFile(value: File | null): string | undefined {
  if (!value) return "Artwork image is required";
  if (!isAllowedImageMimeType(value.type)) {
    return "Only jpeg, png, webp, and gif files are supported";
  }
  if (value.size > MAX_UPLOAD_FILE_BYTES) {
    return "Image is too large. Max size is 5MB";
  }
  return undefined;
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
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

      const imageFile = value.imageFile;
      const imageValidationError = validateArtworkFile(imageFile);
      if (imageValidationError || !imageFile) {
        setSubmitError(imageValidationError ?? "Artwork image is required");
        return;
      }

      const endsAtDate = datetimeLocalToDate(parsedForm.data.endsAt);
      if (!endsAtDate) {
        setSubmitError("Invalid end time");
        return;
      }

      const parsedUploadRequest = createArtworkUploadSchema.safeParse({
        fileName: imageFile.name,
        fileType: imageFile.type,
        fileSize: imageFile.size,
      });
      if (!parsedUploadRequest.success) {
        setSubmitError(parsedUploadRequest.error.issues[0]?.message ?? "Invalid image");
        return;
      }

      try {
        setSubmitPhase("preparingUpload");
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

        setSubmitPhase("uploadingImage");
        const uploadResponse = await fetch(uploadInitJson.signedUrl, {
          method: "PUT",
          headers: {
            "cache-control": "max-age=3600",
            "content-type": imageFile.type,
            "x-upsert": "false",
          },
          body: imageFile,
        });
        if (!uploadResponse.ok) {
          setSubmitError("Image upload failed. Please try again.");
          return;
        }

        setSubmitPhase("creatingAuction");
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
              <div className="space-y-2">
                <Label htmlFor={field.name}>Title</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  disabled={isBusy}
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
                  disabled={isBusy}
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
                    disabled={isBusy}
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
                    disabled={isBusy}
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
                  disabled={isBusy}
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
              onChange: ({ value }) => validateArtworkFile(value),
              onBlur: ({ value }) => validateArtworkFile(value),
            }}
          >
            {(field) => {
              const imageFieldError = field.state.meta.isTouched
                ? validateArtworkFile(field.state.value)
                : undefined;

              return (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Artwork Image</Label>
                  <input
                    id={field.name}
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="block w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:font-medium"
                    disabled={isBusy}
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(event.target.files?.[0] ?? null)
                    }
                  />
                  {field.state.value ? (
                    <p className="text-xs text-muted-foreground">
                      {field.state.value.name}
                    </p>
                  ) : null}
                  {imageFieldError ? (
                    <p className="text-sm text-red-500">{imageFieldError}</p>
                  ) : null}
                </div>
              );
            }}
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
