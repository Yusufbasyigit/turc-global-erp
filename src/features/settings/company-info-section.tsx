"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  appSettingsFormSchema,
  type AppSettingsFormValues,
} from "./schema";
import { getAppSettings, settingsKeys } from "./queries";
import { updateAppSettings } from "./mutations";

const DEFAULTS: AppSettingsFormValues = {
  company_name: "",
  address_line1: "",
  address_line2: "",
  phone: "",
  email: "",
};

export function CompanyInfoSection() {
  const qc = useQueryClient();

  const settingsQ = useQuery({
    queryKey: settingsKeys.app(),
    queryFn: getAppSettings,
  });

  const form = useForm<AppSettingsFormValues>({
    resolver: zodResolver(appSettingsFormSchema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });

  // Hydrate the form once the settings row arrives. Reset is keyed on the
  // updated_time so external changes (e.g. another tab) flow through.
  useEffect(() => {
    if (!settingsQ.data) return;
    form.reset({
      company_name: settingsQ.data.company_name,
      address_line1: settingsQ.data.address_line1,
      address_line2: settingsQ.data.address_line2,
      phone: settingsQ.data.phone,
      email: settingsQ.data.email,
    });
  }, [settingsQ.data, form]);

  const saveMut = useMutation({
    mutationFn: updateAppSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.app() });
      toast.success("Settings saved");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to save settings"),
  });

  const onSubmit = form.handleSubmit((values) => saveMut.mutate(values));

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="editorial-h2">Company info</h2>
        <p className="text-sm text-muted-foreground">
          Letterhead used on proforma invoices and shipment statements.
        </p>
      </header>

      {settingsQ.isLoading ? (
        <div className="space-y-3 rounded-md border p-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      ) : settingsQ.error ? (
        <p className="text-sm text-destructive">
          Failed to load settings: {(settingsQ.error as Error).message}
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-md border bg-card p-5"
        >
          <Field
            label="Company name"
            error={form.formState.errors.company_name?.message}
          >
            <Input
              placeholder="Turc Global Danışmanlık ve Dış Ticaret LTD. ŞTİ."
              {...form.register("company_name")}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Address line 1"
              error={form.formState.errors.address_line1?.message}
            >
              <Input
                placeholder="Çobançeşme Mah., Sanayi Cad. Vadi Sk. No:5"
                {...form.register("address_line1")}
              />
            </Field>
            <Field
              label="Address line 2"
              error={form.formState.errors.address_line2?.message}
            >
              <Input
                placeholder="34196 Bahçelievler · İstanbul · Türkiye"
                {...form.register("address_line2")}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Phone"
              error={form.formState.errors.phone?.message}
            >
              <Input
                placeholder="+90 530 927 57 89"
                {...form.register("phone")}
              />
            </Field>
            <Field
              label="Email"
              error={form.formState.errors.email?.message}
            >
              <Input
                placeholder="info@turcglobal.com"
                type="email"
                {...form.register("email")}
              />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                settingsQ.data &&
                form.reset({
                  company_name: settingsQ.data.company_name,
                  address_line1: settingsQ.data.address_line1,
                  address_line2: settingsQ.data.address_line2,
                  phone: settingsQ.data.phone,
                  email: settingsQ.data.email,
                })
              }
              disabled={saveMut.isPending || !form.formState.isDirty}
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={saveMut.isPending || !form.formState.isDirty}
            >
              {saveMut.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
