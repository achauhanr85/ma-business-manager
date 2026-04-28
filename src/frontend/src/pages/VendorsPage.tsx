import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/contexts/ProfileContext";
import {
  useCreateVendor,
  useDeleteVendor,
  useGetVendors,
  useUpdateVendor,
} from "@/hooks/useBackend";
import type { Vendor, VendorInput } from "@/types";
import {
  Building2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface VendorsPageProps {
  onNavigate: (path: string) => void;
}

const EMPTY_FORM: VendorInput = {
  name: "",
  contact_name: "",
  phone: "",
  email: "",
  address: "",
  is_default: false,
};

interface VendorDialogProps {
  open: boolean;
  editing: Vendor | null;
  profileKey: string;
  onClose: () => void;
}

function VendorDialog({
  open,
  editing,
  profileKey,
  onClose,
}: VendorDialogProps) {
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();

  const [form, setForm] = useState<VendorInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<
    Partial<Record<keyof VendorInput, string>>
  >({});

  // Reset form when dialog opens/closes
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      if (editing) {
        setForm({
          name: editing.name,
          contact_name: editing.contact_name ?? "",
          phone: editing.phone ?? "",
          email: editing.email ?? "",
          address: editing.address ?? "",
          is_default: editing.is_default,
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setErrors({});
    }
  }

  function setField<K extends keyof VendorInput>(
    key: K,
    value: VendorInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof VendorInput, string>> = {};
    if (!form.name.trim()) errs.name = "Vendor name is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const input: VendorInput = {
      name: form.name.trim(),
      contact_name: form.contact_name?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
      email: form.email?.trim() || undefined,
      address: form.address?.trim() || undefined,
      is_default: form.is_default,
    };
    try {
      if (editing) {
        await updateVendor.mutateAsync({ vendorId: editing.id, input });
        toast.success("Vendor updated");
      } else {
        await createVendor.mutateAsync({ input, profileKey });
        toast.success("Vendor created");
      }
      onClose();
    } catch {
      toast.error(
        editing ? "Failed to update vendor" : "Failed to create vendor",
      );
    }
  }

  const loading = createVendor.isPending || updateVendor.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-ocid="vendor.dialog">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="vendor-name">Vendor Name *</Label>
            <Input
              id="vendor-name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Green Herbs Suppliers"
              data-ocid="vendor.name.input"
            />
            {errors.name && (
              <p
                className="text-xs text-destructive"
                data-ocid="vendor.name.field_error"
              >
                {errors.name}
              </p>
            )}
          </div>

          {/* Contact Person */}
          <div className="space-y-1.5">
            <Label htmlFor="vendor-contact">Contact Person</Label>
            <Input
              id="vendor-contact"
              value={form.contact_name ?? ""}
              onChange={(e) =>
                setField("contact_name", e.target.value || undefined)
              }
              placeholder="e.g. Ramesh Patel"
              data-ocid="vendor.contact_name.input"
            />
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vendor-phone">Phone</Label>
              <Input
                id="vendor-phone"
                value={form.phone ?? ""}
                onChange={(e) => setField("phone", e.target.value || undefined)}
                placeholder="+91 98765 43210"
                data-ocid="vendor.phone.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-email">Email</Label>
              <Input
                id="vendor-email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setField("email", e.target.value || undefined)}
                placeholder="vendor@example.com"
                data-ocid="vendor.email.input"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="vendor-address">Address</Label>
            <Textarea
              id="vendor-address"
              value={form.address ?? ""}
              onChange={(e) => setField("address", e.target.value || undefined)}
              placeholder="Full vendor address"
              className="text-sm resize-none min-h-[64px]"
              data-ocid="vendor.address.textarea"
            />
          </div>

          {/* Default vendor toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Set as default vendor</p>
              <p className="text-xs text-muted-foreground">
                Auto-selected on new purchase orders
              </p>
            </div>
            <Switch
              checked={form.is_default}
              onCheckedChange={(v) => setField("is_default", v)}
              data-ocid="vendor.is_default.switch"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-ocid="vendor.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              data-ocid="vendor.submit_button"
            >
              {loading ? "Saving…" : editing ? "Update Vendor" : "Add Vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VendorsPage({ onNavigate: _onNavigate }: VendorsPageProps) {
  const { userProfile } = useProfile();
  const profileKey = userProfile?.profile_key ?? null;

  const { data: vendors = [], isLoading } = useGetVendors(profileKey);
  const deleteVendor = useDeleteVendor();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);

  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.contact_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (v.phone ?? "").includes(search) ||
      (v.email ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteVendor.mutateAsync(deleteTarget.id);
      toast.success("Vendor deleted");
    } catch {
      toast.error("Failed to delete vendor");
    } finally {
      setDeleteTarget(null);
    }
  }

  function openEdit(vendor: Vendor) {
    setEditing(vendor);
    setDialogOpen(true);
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 py-2" data-ocid="vendors.page">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-display font-semibold">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            Manage your purchase order suppliers
          </p>
        </div>
        <Button onClick={openCreate} data-ocid="vendor.add_button">
          <Plus className="w-4 h-4 mr-1.5" />
          Add Vendor
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search vendors by name, contact, phone or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-ocid="vendor.search_input"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3" data-ocid="vendors.loading_state">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && vendors.length === 0 && (
        <div
          className="flex flex-col items-center gap-4 py-16 text-muted-foreground"
          data-ocid="vendors.empty_state"
        >
          <Building2 className="w-12 h-12 opacity-25" />
          <div className="text-center">
            <p className="text-base font-medium text-foreground">
              No vendors yet
            </p>
            <p className="text-sm mt-1">
              Add your first vendor to use in purchase orders
            </p>
          </div>
          <Button onClick={openCreate} data-ocid="vendor.first_add_button">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Vendor
          </Button>
        </div>
      )}

      {/* No search results */}
      {!isLoading && vendors.length > 0 && filtered.length === 0 && (
        <div
          className="text-center py-10 text-muted-foreground"
          data-ocid="vendors.no_results"
        >
          <p className="text-sm">No vendors match your search</p>
        </div>
      )}

      {/* Vendor list */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-3" data-ocid="vendors.list">
          {filtered.map((vendor, idx) => (
            <div
              key={vendor.id}
              className="rounded-xl border border-border bg-card p-4 hover:bg-card/80 transition-colors"
              data-ocid={`vendors.item.${idx + 1}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  {/* Name + default badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">
                      {vendor.name}
                    </p>
                    {vendor.is_default && (
                      <Badge className="text-xs bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
                        <Star className="w-2.5 h-2.5" />
                        Default
                      </Badge>
                    )}
                  </div>

                  {/* Contact details */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {vendor.contact_name && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3 shrink-0" />
                        {vendor.contact_name}
                      </span>
                    )}
                    {vendor.phone && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3 shrink-0" />
                        {vendor.phone}
                      </span>
                    )}
                    {vendor.email && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3 shrink-0" />
                        {vendor.email}
                      </span>
                    )}
                  </div>

                  {vendor.address && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {vendor.address}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => openEdit(vendor)}
                    aria-label="Edit vendor"
                    data-ocid={`vendor.edit_button.${idx + 1}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(vendor)}
                    aria-label="Delete vendor"
                    data-ocid={`vendor.delete_button.${idx + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      {profileKey && (
        <VendorDialog
          open={dialogOpen}
          editing={editing}
          profileKey={profileKey}
          onClose={() => {
            setDialogOpen(false);
            setEditing(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent data-ocid="vendor.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be permanently removed.
              Existing purchase orders that reference this vendor will retain
              the vendor name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="vendor.delete.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="vendor.delete.confirm_button"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
