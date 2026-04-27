"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Users,
  ChevronDown,
  ChevronRight,
  Archive,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  CONTACT_TYPES,
  type ContactType,
  type ContactWithCountry,
} from "@/lib/supabase/types";
import { CONTACT_TYPE_LABELS } from "@/lib/constants";
import { contactKeys, listContacts, listDeletedContacts } from "./queries";
import { ContactsTable } from "./contacts-table";
import { ContactsCardList } from "./contacts-card-list";
import { ContactFormDialog } from "./contact-form-dialog";
import { DeleteContactDialog } from "./delete-contact-dialog";
import { ArchivedContactsTable } from "./archived-contacts-table";
import { RestoreContactDialog } from "./restore-contact-dialog";

type TypeFilter = "all" | ContactType;
type View = "active" | "archive";

export function ContactsIndex() {
  const isMobile = useIsMobile();
  const [view, setView] = useState<View>("active");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [groupByCountry, setGroupByCountry] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: contacts, isLoading, isError, error } = useQuery({
    queryKey: contactKeys.list(),
    queryFn: listContacts,
  });

  const {
    data: deletedContacts,
    isLoading: isLoadingArchive,
    isError: isErrorArchive,
    error: archiveError,
  } = useQuery({
    queryKey: contactKeys.archive(),
    queryFn: listDeletedContacts,
    enabled: view === "archive",
  });

  const filtered = useMemo(() => {
    if (!contacts) return [];
    const term = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (!term) return true;
      return (
        c.company_name.toLowerCase().includes(term) ||
        (c.contact_person?.toLowerCase().includes(term) ?? false) ||
        (c.email?.toLowerCase().includes(term) ?? false) ||
        (c.phone?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [contacts, search, typeFilter]);

  const openCreate = () => {
    setEditingId(null);
    setFormOpen(true);
  };
  const openEdit = (id: string) => {
    setEditingId(id);
    setFormOpen(true);
  };
  const openDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name });
    setDeleteOpen(true);
  };
  const openRestore = (id: string, name: string) => {
    setRestoreTarget({ id, name });
    setRestoreOpen(true);
  };

  const hasAnyContacts = (contacts?.length ?? 0) > 0;
  const hasFilteredContacts = filtered.length > 0;
  const archiveCount = deletedContacts?.length ?? 0;
  const hasArchive = archiveCount > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Customers, suppliers, logistics providers, and other parties.
          </p>
        </div>
        <div className="flex items-center gap-2 md:self-end">
          <Button
            variant={view === "archive" ? "default" : "outline"}
            onClick={() => setView((v) => (v === "active" ? "archive" : "active"))}
          >
            <Archive className="mr-2 size-4" />
            {view === "archive" ? "Back to contacts" : "Archive"}
          </Button>
          {hasAnyContacts && view === "active" ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              Add contact
            </Button>
          ) : null}
        </div>
      </header>

      {view === "active" ? (
        <>
          {hasAnyContacts ? (
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1 md:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search company, person, email, phone…"
                  className="pl-9"
                />
              </div>
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as TypeFilter)}
              >
                <SelectTrigger className="md:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {CONTACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CONTACT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={groupByCountry ? "default" : "outline"}
                onClick={() => setGroupByCountry((v) => !v)}
                className="md:w-auto"
              >
                Group by country
              </Button>
            </div>
          ) : null}

          {isLoading ? <ListSkeleton /> : null}

          {isError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              Failed to load contacts: {(error as Error).message}
            </div>
          ) : null}

          {!isLoading && !isError && !hasAnyContacts ? (
            <EmptyState onAdd={openCreate} />
          ) : null}

          {!isLoading && !isError && hasAnyContacts && !hasFilteredContacts ? (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              No contacts match the current filters.
            </div>
          ) : null}

          {!isLoading && hasFilteredContacts ? (
            groupByCountry ? (
              <GroupedView
                contacts={filtered}
                isMobile={isMobile}
                onEdit={openEdit}
                onDelete={openDelete}
              />
            ) : isMobile ? (
              <ContactsCardList
                contacts={filtered}
                onEdit={openEdit}
                onDelete={openDelete}
              />
            ) : (
              <ContactsTable
                contacts={filtered}
                onEdit={openEdit}
                onDelete={openDelete}
              />
            )
          ) : null}
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Deleted contacts. Restoring brings a contact back to your active
            list with all its data intact.
          </p>

          {isLoadingArchive ? <ListSkeleton /> : null}

          {isErrorArchive ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              Failed to load archive: {(archiveError as Error).message}
            </div>
          ) : null}

          {!isLoadingArchive && !isErrorArchive && !hasArchive ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 p-12 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                <Archive className="size-6 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium">Archive is empty</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Deleted contacts will appear here and can be restored at any
                time.
              </p>
            </div>
          ) : null}

          {!isLoadingArchive && hasArchive ? (
            <ArchivedContactsTable
              contacts={deletedContacts ?? []}
              onRestore={openRestore}
            />
          ) : null}
        </>
      )}

      <ContactFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditingId(null);
        }}
        contactId={editingId}
      />

      {deleteTarget ? (
        <DeleteContactDialog
          open={deleteOpen}
          onOpenChange={(o) => {
            setDeleteOpen(o);
            if (!o) setDeleteTarget(null);
          }}
          contactId={deleteTarget.id}
          contactName={deleteTarget.name}
        />
      ) : null}

      {restoreTarget ? (
        <RestoreContactDialog
          open={restoreOpen}
          onOpenChange={(o) => {
            setRestoreOpen(o);
            if (!o) setRestoreTarget(null);
          }}
          contactId={restoreTarget.id}
          contactName={restoreTarget.name}
        />
      ) : null}
    </div>
  );
}

function GroupedView({
  contacts,
  isMobile,
  onEdit,
  onDelete,
}: {
  contacts: ContactWithCountry[];
  isMobile: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        flag: string;
        contacts: ContactWithCountry[];
      }
    >();
    for (const c of contacts) {
      const code = c.countries?.code ?? "__none";
      const name = c.countries?.name_en ?? "No country";
      const flag = c.countries?.flag_emoji ?? "🏳️";
      const entry = map.get(code) ?? { key: code, name, flag, contacts: [] };
      entry.contacts.push(c);
      map.set(code, entry);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [contacts]);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <CountryGroup
          key={g.key}
          name={g.name}
          flag={g.flag}
          contacts={g.contacts}
          isMobile={isMobile}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function CountryGroup({
  name,
  flag,
  contacts,
  isMobile,
  onEdit,
  onDelete,
}: {
  name: string;
  flag: string;
  contacts: ContactWithCountry[];
  isMobile: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted/40"
      >
        {open ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
        <span className="text-lg" aria-hidden>
          {flag}
        </span>
        <h2 className="text-sm font-medium">{name}</h2>
        <span className="ml-1 text-xs text-muted-foreground">
          ({contacts.length})
        </span>
      </button>
      {open ? (
        isMobile ? (
          <ContactsCardList
            contacts={contacts}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ) : (
          <ContactsTable
            contacts={contacts}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )
      ) : null}
    </section>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 p-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <Users className="size-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-medium">No contacts yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Add your first customer, supplier, or logistics provider to start
        tracking.
      </p>
      <Button onClick={onAdd} className="mt-6">
        <Plus className="mr-2 size-4" />
        Add your first contact
      </Button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
