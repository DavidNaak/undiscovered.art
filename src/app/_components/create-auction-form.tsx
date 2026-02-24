"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import {
  AlignLeft,
  CalendarIcon,
  DollarSign,
  ImageIcon,
  Info,
  Plus,
  Ruler,
  Type,
  Upload,
  X,
} from "lucide-react";

import { AUCTION_CATEGORY_OPTIONS } from "~/lib/auctions/categories";
import { AUCTION_CONDITION_OPTIONS } from "~/lib/auctions/conditions";
import { auctionCategorySchema, auctionConditionSchema, createAuctionFormSchema } from "~/lib/auctions/schema";
import { api } from "~/trpc/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitCreateAuction } from "./create-auction-form.submit";
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

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const [isDragActive, setIsDragActive] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const minEndAt = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    return now.toISOString().slice(0, 16);
  }, []);

  const previewUrl = useMemo(
    () => (previewFile ? URL.createObjectURL(previewFile) : null),
    [previewFile],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const form = useForm({
    defaultValues: DEFAULT_AUCTION_FORM_VALUES,
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      setSubmitSuccess(null);

      try {
        const fallbackImageFile = fileInputRef.current?.files?.[0] ?? null;

        await submitCreateAuction({
          value: {
            ...value,
            imageFile: value.imageFile ?? fallbackImageFile,
          },
          setSubmitPhase,
          createAuction: createAuction.mutateAsync,
        });

        setSubmitSuccess("Auction created.");
        setPreviewFile(null);
        form.reset();
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        window.setTimeout(() => {
          setIsDialogOpen(false);
          setSubmitSuccess(null);
        }, 550);
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
      <Button
        className="h-12 rounded-full bg-foreground px-6 text-base text-background hover:bg-foreground/90"
        nativeButton={false}
        render={<Link href="/login" />}
      >
        Sign in to create
      </Button>
    );
  }

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(nextOpen) => {
        setIsDialogOpen(nextOpen);

        if (!nextOpen) {
          setSubmitError(null);
          setSubmitSuccess(null);
          setSubmitPhase("idle");
          setIsDragActive(false);
          setPreviewFile(null);
          form.reset();
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      }}
    >
      <DialogTrigger
        render={
          <Button className="h-12 rounded-full bg-foreground px-7 text-base text-background hover:bg-foreground/90" />
        }
      >
        <Plus className="size-4" />
        Create Auction
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[28px] border-border/90 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border/80 px-5 py-5 pr-12">
          <DialogTitle className="font-serif text-xl">Create Auction</DialogTitle>
          <DialogDescription>
            Upload artwork and launch a timed listing.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <form.Field
              name="imageFile"
              validators={{
                onChange: ({ value }) => validateArtworkFile(value),
                onBlur: ({ value }) => validateArtworkFile(value),
              }}
            >
              {(field) => {
                const selectedFile =
                  field.state.value ?? fileInputRef.current?.files?.[0] ?? null;
                const imageFieldError = field.state.meta.isTouched
                  ? validateArtworkFile(selectedFile)
                  : undefined;

                function setFile(nextFile: File | null) {
                  field.handleChange(nextFile);
                  setPreviewFile(nextFile);
                }

                return (
                  <div className="space-y-2">
                    <Label htmlFor={field.name} className="flex items-center gap-2">
                      <ImageIcon className="text-muted-foreground size-4" />
                      Artwork Image
                    </Label>
                    <div
                      className={cn(
                        "relative flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors",
                        isDragActive
                          ? "border-accent bg-accent/5"
                          : "border-border hover:border-accent/40 hover:bg-secondary/40",
                        selectedFile && "border-solid border-border",
                      )}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setIsDragActive(true);
                      }}
                      onDragLeave={() => setIsDragActive(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setIsDragActive(false);
                        const file = event.dataTransfer.files?.[0] ?? null;
                        if (!file) return;
                        setFile(file);
                      }}
                    >
                      {previewUrl ? (
                        <div className="relative h-44 w-full">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={previewUrl}
                            alt="Artwork preview"
                            className="h-full w-full rounded-[10px] object-cover"
                          />
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setFile(null);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = "";
                              }
                            }}
                            className="absolute top-2 right-2 rounded-full bg-black/70 p-1 text-white transition hover:bg-black/85"
                            aria-label="Remove selected image"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 px-4 py-8 text-center">
                          <div className="bg-secondary mx-auto w-fit rounded-full p-3">
                            <Upload className="text-muted-foreground size-5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Drop artwork here</p>
                            <p className="text-muted-foreground text-xs">
                              or click to browse. JPG, PNG, WEBP, GIF up to 5MB.
                            </p>
                          </div>
                        </div>
                      )}
                      <input
                        id={field.name}
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        disabled={isBusy}
                        onBlur={field.handleBlur}
                        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      />
                    </div>
                    {selectedFile ? (
                      <p className="text-muted-foreground text-xs">{selectedFile.name}</p>
                    ) : null}
                    {imageFieldError ? (
                      <p className="text-sm text-red-500">{imageFieldError}</p>
                    ) : null}
                  </div>
                );
              }}
            </form.Field>

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
                  <Label htmlFor={field.name} className="flex items-center gap-2">
                    <Type className="text-muted-foreground size-4" />
                    Title
                  </Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    disabled={isBusy}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Evening Glow, 2026"
                    className="h-11 rounded-xl"
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
              name="category"
              validators={{
                onBlur: ({ value }) =>
                  toFieldError(
                    createAuctionFormSchema.shape.category.safeParse(value).error?.issues[0]
                      ?.message,
                  ),
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Type className="text-muted-foreground size-4" />
                    Category
                  </Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => {
                      const parsedCategory = auctionCategorySchema.safeParse(value);
                      if (parsedCategory.success) {
                        field.handleChange(parsedCategory.data);
                      }
                    }}
                    disabled={isBusy}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl">
                      <SelectValue placeholder="Select a medium" />
                    </SelectTrigger>
                    <SelectContent>
                      {AUCTION_CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <form.Field
                name="dimensions"
                validators={{
                  onBlur: ({ value }) =>
                    toFieldError(
                      createAuctionFormSchema.shape.dimensions.safeParse(value).error
                        ?.issues[0]?.message,
                    ),
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name} className="flex items-center gap-2">
                      <Ruler className="text-muted-foreground size-4" />
                      Dimensions
                    </Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      disabled={isBusy}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="48 x 36 in"
                      className="h-11 rounded-xl"
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
                name="condition"
                validators={{
                  onBlur: ({ value }) =>
                    toFieldError(
                      createAuctionFormSchema.shape.condition.safeParse(value).error
                        ?.issues[0]?.message,
                    ),
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Info className="text-muted-foreground size-4" />
                      Condition
                    </Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => {
                        const parsedCondition = auctionConditionSchema.safeParse(value);
                        if (parsedCondition.success) {
                          field.handleChange(parsedCondition.data);
                        }
                      }}
                      disabled={isBusy}
                    >
                      <SelectTrigger className="h-11 w-full rounded-xl">
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        {AUCTION_CONDITION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>
            </div>

            <form.Field
              name="artworkYear"
              validators={{
                onBlur: ({ value }) =>
                  toFieldError(
                    createAuctionFormSchema.shape.artworkYear.safeParse(value).error
                      ?.issues[0]?.message,
                  ),
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name} className="flex items-center gap-2">
                    <CalendarIcon className="text-muted-foreground size-4" />
                    Year
                  </Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    disabled={isBusy}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="2026"
                    inputMode="numeric"
                    className="h-11 rounded-xl"
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
                  <Label htmlFor={field.name} className="flex items-center gap-2">
                    <AlignLeft className="text-muted-foreground size-4" />
                    Description
                  </Label>
                  <Textarea
                    id={field.name}
                    value={field.state.value}
                    disabled={isBusy}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Medium, dimensions, and the story behind this piece..."
                    rows={3}
                    className="resize-none rounded-xl"
                  />
                </div>
              )}
            </form.Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <form.Field
                name="startPrice"
                validators={{
                  onBlur: ({ value }) =>
                    toFieldError(
                      createAuctionFormSchema.shape.startPrice.safeParse(value).error?.issues[0]
                        ?.message,
                    ),
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name} className="flex items-center gap-2">
                      <DollarSign className="text-muted-foreground size-4" />
                      Start Price
                    </Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      disabled={isBusy}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="100.00"
                      inputMode="decimal"
                      className="h-11 rounded-xl"
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
                    <Label htmlFor={field.name}>Min Increment</Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      disabled={isBusy}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="10.00"
                      inputMode="decimal"
                      className="h-11 rounded-xl"
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
                  <Label htmlFor={field.name} className="flex items-center gap-2">
                    <CalendarIcon className="text-muted-foreground size-4" />
                    Auction Ends At
                  </Label>
                  <Input
                    id={field.name}
                    type="datetime-local"
                    value={field.state.value}
                    min={minEndAt}
                    disabled={isBusy}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    className="h-11 rounded-xl"
                  />
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

            {isBusy ? (
              <p className="text-muted-foreground text-sm">{getSubmitLabel(submitPhase)}</p>
            ) : null}

            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([_, isSubmitting]) => (
                <Button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-foreground text-background hover:bg-foreground/90"
                  disabled={(isSubmitting ?? false) || createAuction.isPending || isBusy}
                >
                  {submitPhase !== "idle"
                    ? getSubmitLabel(submitPhase)
                    : (isSubmitting ?? false) || createAuction.isPending
                      ? "Validating..."
                      : "Launch Auction"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
