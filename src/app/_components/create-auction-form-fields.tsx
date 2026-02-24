"use client";

import { type HTMLAttributes, type RefObject } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { toFieldError, validateArtworkFile } from "./create-auction-form.types";

type FieldMeta = {
  isTouched: boolean;
  errors: Array<unknown>;
};

type StringField = {
  name: string;
  state: {
    value: string;
    meta: FieldMeta;
  };
  handleBlur: () => void;
  handleChange: (value: string) => void;
};

type FileField = {
  name: string;
  state: {
    value: File | null;
    meta: FieldMeta;
  };
  handleBlur: () => void;
  handleChange: (value: File | null) => void;
};

export function TextInputFormField({
  field,
  label,
  placeholder,
  disabled,
  type = "text",
  inputMode,
  min,
}: {
  field: StringField;
  label: string;
  placeholder?: string;
  disabled: boolean;
  type?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  min?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        type={type}
        value={field.state.value}
        disabled={disabled}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        min={min}
      />
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
        <p className="text-sm text-red-500">{toFieldError(field.state.meta.errors[0])}</p>
      ) : null}
    </div>
  );
}

export function TextareaFormField({
  field,
  label,
  placeholder,
  disabled,
  rows = 4,
}: {
  field: StringField;
  label: string;
  placeholder?: string;
  disabled: boolean;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Textarea
        id={field.name}
        value={field.state.value}
        disabled={disabled}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );
}

export function ArtworkFileFormField({
  field,
  disabled,
  fileInputRef,
}: {
  field: FileField;
  disabled: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
}) {
  const selectedFile = field.state.value ?? fileInputRef.current?.files?.[0] ?? null;

  const imageFieldError = field.state.meta.isTouched
    ? validateArtworkFile(selectedFile)
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
        disabled={disabled}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.files?.[0] ?? null)}
      />
      {selectedFile ? (
        <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
      ) : null}
      {imageFieldError ? <p className="text-sm text-red-500">{imageFieldError}</p> : null}
    </div>
  );
}
