import { redirect } from "@remix-run/node";

export type FieldErrors = Record<string, string>;

export function readRequiredString(formData: FormData, field: string, errors: FieldErrors) {
  const value = formData.get(field);
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    errors[field] = "Required";
  }
  return text;
}

export function readOptionalString(formData: FormData, field: string) {
  const value = formData.get(field);
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

export function readPositiveInteger(formData: FormData, field: string, errors: FieldErrors) {
  const value = formData.get(field);
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 0) {
    errors[field] = "Enter a whole number";
    return 0;
  }
  return parsed;
}

export function redirectWithError(path: string, message: string) {
  const params = new URLSearchParams({ error: message });
  throw redirect(`${path}?${params.toString()}`);
}
