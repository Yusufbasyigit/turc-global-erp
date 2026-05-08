"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  contactKeys,
  getContact,
  listContactNotes,
} from "./queries";
import { ContactRoleBadges } from "./role-badges";
import { CountryFlag } from "./country-flag";
import { ContactFormDialog } from "./contact-form-dialog";
import { DeleteContactDialog } from "./delete-contact-dialog";
import { AddNoteDialog } from "./add-note-dialog";
import { ContactLedgerSection } from "./contact-ledger-section";
import { SupplierLedgerSection } from "./supplier-ledger-section";
import { ContactRealEstateSection } from "./contact-real-estate-section";

export function ContactDetail({ contactId }: { contactId: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const {
    data: contact,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: contactKeys.detail(contactId),
    queryFn: () => getContact(contactId),
  });

  const {
    data: notes = [],
    isLoading: notesLoading,
    isError: notesError,
    error: notesErrorObj,
  } = useQuery({
    queryKey: contactKeys.notes(contactId),
    queryFn: () => listContactNotes(contactId),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load contact: {(error as Error).message}
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            This contact does not exist or was deleted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <ContactRoleBadges contact={contact} />
            <CountryFlag country={contact.countries} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {contact.company_name}
          </h1>
          {contact.contact_person ? (
            <p className="text-sm text-muted-foreground">
              {contact.contact_person}
            </p>
          ) : null}
          {contact.tax_id || contact.tax_office ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {contact.tax_id ? (
                <span>
                  Tax ID:{" "}
                  <span className="font-mono text-foreground">
                    {contact.tax_id}
                  </span>
                </span>
              ) : null}
              {contact.tax_office ? (
                <span>Vergi Dairesi: {contact.tax_office}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-y-4 gap-x-8 pb-4 md:grid-cols-2">
          <DetailField label="Phone" value={contact.phone} />
          <DetailField label="Email" value={contact.email} />
          <DetailField label="Address" value={contact.address} />
          <DetailField label="City" value={contact.city} />
          <DetailField
            label="Country"
            value={
              contact.countries ? (
                <CountryFlag country={contact.countries} />
              ) : null
            }
          />
          <DetailField
            label="Balance currency"
            value={contact.balance_currency}
          />
          {contact.notes ? (
            <div className="md:col-span-2">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {contact.notes}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Activity log</CardTitle>
            <p className="text-xs text-muted-foreground">
              Append-only. Dated notes, newest first.
            </p>
          </div>
          <Button size="sm" onClick={() => setNoteOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add note
          </Button>
        </CardHeader>
        <CardContent className="pb-4">
          {notesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : notesError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              Failed to load notes: {(notesErrorObj as Error)?.message}
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="mb-3 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No activity yet. Add a note to start a history.
              </p>
            </div>
          ) : (
            <ol className="space-y-4">
              {notes.map((n, i) => (
                <li key={n.id} className="relative pl-5">
                  <span
                    aria-hidden
                    className="absolute left-0 top-1.5 size-2 rounded-full bg-primary"
                  />
                  {i < notes.length - 1 ? (
                    <span
                      aria-hidden
                      className="absolute left-[3px] top-4 bottom-[-1rem] w-px bg-border"
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(n.note_date), "PPP")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {contact.is_customer ? (
        <ContactLedgerSection contactId={contactId} />
      ) : null}
      {contact.is_supplier || contact.is_logistics ? (
        <SupplierLedgerSection contactId={contactId} />
      ) : null}

      <ContactRealEstateSection contactId={contactId} />

      <ContactFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        contactId={contactId}
      />
      <DeleteContactDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        contactId={contactId}
        contactName={contact.company_name}
        redirectOnSuccess
      />
      <AddNoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        contactId={contactId}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/contacts"
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to contacts
    </Link>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm">
        {value == null || value === "" ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}
