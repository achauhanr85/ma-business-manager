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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/contexts/ProfileContext";
import {
  useCheckCustomerDuplicate,
  useCreateCustomer,
  useDeleteCustomer,
  useGetCustomerOrders,
  useGetCustomers,
  useUpdateCustomer,
} from "@/hooks/useBackend";
import {
  clearStoredCustomerDiscount,
  getStoredCustomerDiscount,
} from "@/lib/discountStore";
import type { CustomerPublic } from "@/types";
import type {
  CustomerInputExtended,
  CustomerOrderFlat,
  CustomerPublicWithDiscount,
  DiscountType,
} from "@/types";
import { ROLES } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Clock,
  CreditCard,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Pencil,
  Percent,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Tag,
  Trash2,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createActor } from "../backend";
import type {
  BodyCompositionEntry,
  BodyCompositionInput,
  CustomerId,
} from "../backend";

interface CustomersPageProps {
  onNavigate: (path: string, saleId?: bigint) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: number): string {
  return `₹${v.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(ts: bigint): string {
  if (ts === BigInt(0)) return "—";
  const ms = Number(ts / BigInt(1_000_000));
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

function formatDateFull(ts: bigint): string {
  if (ts === BigInt(0)) return "—";
  const ms = Number(ts / BigInt(1_000_000));
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

function DiscountBadge({
  discount_applicable,
  discount_value,
}: {
  discount_applicable?: DiscountType;
  discount_value?: number;
}) {
  if (
    !discount_applicable ||
    discount_value === undefined ||
    discount_value === 0
  )
    return null;
  return (
    <Badge
      variant="outline"
      className="text-xs border-primary/40 text-primary flex items-center gap-0.5"
    >
      <Tag className="w-3 h-3" />
      {discount_applicable === "Percentage"
        ? `${discount_value}%`
        : `₹${discount_value}`}
    </Badge>
  );
}

// ─── Body Composition Hooks (local, using actor pattern) ──────────────────────

function useBackendActor() {
  return useActor(createActor);
}

function useGetBodyCompositionHistory(customerId: CustomerId | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<BodyCompositionEntry[]>({
    queryKey: ["body-composition", customerId?.toString()],
    queryFn: async () => {
      if (!actor || !customerId) return [];
      return actor.getBodyCompositionHistory(customerId);
    },
    enabled: !!actor && !isFetching && !!customerId,
  });
}

function useCreateBodyCompositionEntry() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      customerId,
      input,
    }: {
      customerId: CustomerId;
      input: BodyCompositionInput;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createBodyCompositionEntry(customerId, input);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["body-composition", variables.customerId.toString()],
      });
    },
  });
}

function useDeleteBodyCompositionEntry() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      customerId: _customerId,
    }: {
      id: string;
      customerId: CustomerId;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deleteBodyCompositionEntry(id);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["body-composition", variables.customerId.toString()],
      });
    },
  });
}

// ─── Body Composition Entry Form ──────────────────────────────────────────────

const EMPTY_BODY_COMP: BodyCompositionInput = { date: "" };

interface BodyCompFormProps {
  open: boolean;
  customerId: CustomerId;
  onClose: () => void;
}

function BodyCompositionEntryDialog({
  open,
  customerId,
  onClose,
}: BodyCompFormProps) {
  const createEntry = useCreateBodyCompositionEntry();
  const [form, setForm] = useState<BodyCompositionInput>(EMPTY_BODY_COMP);

  useEffect(() => {
    if (open) setForm({ date: new Date().toISOString().split("T")[0] });
  }, [open]);

  function numField(
    key: keyof Omit<BodyCompositionInput, "date" | "body_age">,
    value: string,
  ) {
    const v = value === "" ? undefined : Number.parseFloat(value);
    setForm((prev) => ({ ...prev, [key]: v }));
  }

  function bodyAgeField(value: string) {
    const v = value === "" ? undefined : BigInt(Math.floor(Number(value)));
    setForm((prev) => ({ ...prev, body_age: v }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date) {
      toast.error("Date is required");
      return;
    }
    try {
      await createEntry.mutateAsync({ customerId, input: form });
      toast.success("Body composition entry saved");
      onClose();
    } catch {
      toast.error("Failed to save entry");
    }
  }

  const fieldCls = "space-y-1.5";
  const inputCls = "h-8 text-xs";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-lg"
        data-ocid="body_composition.add.dialog"
      >
        <DialogHeader>
          <DialogTitle>Add Body Composition Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className={fieldCls}>
            <Label htmlFor="bc-date" className="text-xs">
              Date *
            </Label>
            <Input
              id="bc-date"
              type="date"
              className={inputCls}
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              required
              data-ocid="body_composition.date.input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["weight", "Weight (kg)"],
                ["body_fat", "Body Fat (%)"],
                ["visceral_fat", "Visceral Fat"],
                ["bmr", "BMR (kcal)"],
                ["bmi", "BMI"],
                ["trunk_fat", "Trunk Fat (%)"],
                ["muscle_mass", "Muscle Mass (kg)"],
              ] as [
                keyof Omit<BodyCompositionInput, "date" | "body_age">,
                string,
              ][]
            ).map(([key, label]) => (
              <div key={key} className={fieldCls}>
                <Label htmlFor={`bc-${key}`} className="text-xs">
                  {label}
                </Label>
                <Input
                  id={`bc-${key}`}
                  type="number"
                  step="0.01"
                  min={0}
                  className={inputCls}
                  value={form[key] !== undefined ? String(form[key]) : ""}
                  onChange={(e) => numField(key, e.target.value)}
                  data-ocid={`body_composition.${key}.input`}
                />
              </div>
            ))}
            <div className={fieldCls}>
              <Label htmlFor="bc-body-age" className="text-xs">
                Body Age (yrs)
              </Label>
              <Input
                id="bc-body-age"
                type="number"
                step="1"
                min={0}
                className={inputCls}
                value={form.body_age !== undefined ? String(form.body_age) : ""}
                onChange={(e) => bodyAgeField(e.target.value)}
                data-ocid="body_composition.body_age.input"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-ocid="body_composition.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createEntry.isPending}
              data-ocid="body_composition.save_button"
            >
              {createEntry.isPending ? "Saving…" : "Save Entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Body Composition Tab ─────────────────────────────────────────────────────

function BodyCompositionTab({ customer }: { customer: CustomerPublic }) {
  const { data: entries = [], isLoading } = useGetBodyCompositionHistory(
    customer.id,
  );
  const deleteEntry = useDeleteBodyCompositionEntry();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const sorted = [...entries].sort((a, b) => {
    if (a.date < b.date) return 1;
    if (a.date > b.date) return -1;
    return 0;
  });

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteEntry.mutateAsync({
        id: deleteTarget,
        customerId: customer.id,
      });
      toast.success("Entry deleted");
    } catch {
      toast.error("Failed to delete entry");
    } finally {
      setDeleteTarget(null);
    }
  }

  function fmt(v: number | undefined, decimals = 1): string {
    if (v === undefined) return "—";
    return v.toFixed(decimals);
  }

  return (
    <div className="space-y-4" data-ocid="customer.body_composition.panel">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {entries.length} {entries.length === 1 ? "entry" : "entries"} recorded
        </p>
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          data-ocid="body_composition.add_button"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Entry
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2" data-ocid="body_composition.loading_state">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div
          className="flex flex-col items-center gap-3 py-8 text-muted-foreground"
          data-ocid="body_composition.empty_state"
        >
          <Activity className="w-10 h-10 opacity-30" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              No body composition data
            </p>
            <p className="text-xs mt-0.5">
              Add an entry to track progress over time
            </p>
          </div>
        </div>
      )}

      {!isLoading && sorted.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table
              className="w-full text-xs min-w-[560px]"
              data-ocid="body_composition.table"
            >
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {[
                    "Date",
                    "Weight",
                    "Body Fat",
                    "Visceral",
                    "BMR",
                    "BMI",
                    "Body Age",
                    "Trunk Fat",
                    "Muscle",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors"
                    data-ocid={`body_composition.item.${idx + 1}`}
                  >
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {entry.date}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmt(entry.weight)} kg
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmt(entry.body_fat)}%
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmt(entry.visceral_fat)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmt(entry.bmr, 0)} kcal
                    </td>
                    <td className="px-3 py-2 tabular-nums">{fmt(entry.bmi)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {entry.body_age !== undefined
                        ? `${entry.body_age} yrs`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmt(entry.trunk_fat)}%
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmt(entry.muscle_mass)} kg
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(entry.id)}
                        aria-label="Delete entry"
                        data-ocid={`body_composition.delete_button.${idx + 1}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BodyCompositionEntryDialog
        open={addOpen}
        customerId={customer.id}
        onClose={() => setAddOpen(false)}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent data-ocid="body_composition.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This body composition entry will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="body_composition.delete.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="body_composition.delete.confirm_button"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Customer Form / Create Dialog ───────────────────────────────────────────

interface CustomerDialogProps {
  open: boolean;
  editing: CustomerPublicWithDiscount | null;
  onClose: () => void;
}

const EMPTY_FORM: CustomerInputExtended = {
  name: "",
  phone: "",
  email: "",
  address: "",
  discount_applicable: undefined,
  discount_value: undefined,
  notes: "",
  date_of_birth: undefined,
  gender: undefined,
};

type DuplicateState =
  | { step: "idle" }
  | { step: "checking" }
  | { step: "found"; similar_name: string; existing_id: bigint }
  | { step: "confirmed_new" };

function CustomerDialog({ open, editing, onClose }: CustomerDialogProps) {
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const checkDuplicate = useCheckCustomerDuplicate();

  const [form, setForm] = useState<CustomerInputExtended>(EMPTY_FORM);
  const [errors, setErrors] = useState<
    Partial<Record<keyof CustomerInputExtended, string>>
  >({});
  const [dupState, setDupState] = useState<DuplicateState>({ step: "idle" });
  const nameCheckedRef = useRef<string>("");

  useEffect(() => {
    if (open) {
      if (editing) {
        const ext = editing as CustomerPublicWithDiscount;
        setForm({
          name: ext.name,
          phone: ext.phone,
          email: ext.email,
          address: ext.address,
          discount_applicable: ext.discount_applicable,
          discount_value: ext.discount_value,
          notes: ext.notesText ?? "",
          date_of_birth: ext.date_of_birth ?? "",
          gender: ext.gender ?? "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setErrors({});
      setDupState({ step: "idle" });
      nameCheckedRef.current = "";
    }
  }, [editing, open]);

  function setField<K extends keyof CustomerInputExtended>(
    key: K,
    value: CustomerInputExtended[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (key === "name" && dupState.step !== "idle") {
      setDupState({ step: "idle" });
    }
  }

  async function handleNameBlur() {
    if (editing) return;
    const name = form.name.trim();
    if (!name || name === nameCheckedRef.current) return;
    nameCheckedRef.current = name;
    setDupState({ step: "checking" });
    try {
      const result = await checkDuplicate.mutateAsync(name);
      if (result.has_similar && result.similar_customers.length > 0) {
        setDupState({
          step: "found",
          similar_name: result.similar_customers[0].name,
          existing_id: result.similar_customers[0].id,
        });
      } else {
        setDupState({ step: "idle" });
      }
    } catch {
      setDupState({ step: "idle" });
    }
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof CustomerInputExtended, string>> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.phone.trim()) errs.phone = "Phone is required";
    if (
      form.discount_applicable &&
      (form.discount_value === undefined || form.discount_value < 0)
    ) {
      errs.discount_value = "Enter a valid discount value";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const customerInput = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      ...(form.discount_applicable !== undefined && {
        discount_applicable: form.discount_applicable,
      }),
      ...(form.discount_value !== undefined && {
        discount_value: form.discount_value,
      }),
      ...(form.notes && { note: form.notes }),
      ...(form.date_of_birth && { date_of_birth: form.date_of_birth }),
      ...(form.gender && form.gender !== "" && { gender: form.gender }),
    };
    try {
      if (editing) {
        await updateCustomer.mutateAsync({
          id: editing.id,
          input: customerInput,
        });
        toast.success("Customer updated successfully");
      } else {
        await createCustomer.mutateAsync(customerInput);
        toast.success("Customer added successfully");
      }
      onClose();
    } catch {
      toast.error(
        editing ? "Failed to update customer" : "Failed to create customer",
      );
    }
  }

  const loading = createCustomer.isPending || updateCustomer.isPending;
  const showForm = dupState.step !== "found";
  const showDiscountValue = !!form.discount_applicable;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-ocid="customer.dialog">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Customer" : "Add Customer"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="cust-name">Name *</Label>
            <Input
              id="cust-name"
              data-ocid="customer.name.input"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              onBlur={handleNameBlur}
              placeholder="e.g. Priya Sharma"
              required
              disabled={dupState.step === "found"}
            />
            {errors.name && (
              <p
                className="text-xs text-destructive"
                data-ocid="customer.name.field_error"
              >
                {errors.name}
              </p>
            )}
            {dupState.step === "checking" && (
              <p className="text-xs text-muted-foreground animate-pulse">
                Checking for similar customers…
              </p>
            )}
          </div>

          {/* Duplicate warning */}
          {dupState.step === "found" && (
            <div
              className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3"
              data-ocid="customer.duplicate_warning"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Similar customer found</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A customer named <strong>"{dupState.similar_name}"</strong>{" "}
                    already exists. Is this the same person?
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={onClose}
                  data-ocid="customer.use_existing_button"
                >
                  Yes, use existing
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setDupState({ step: "confirmed_new" })}
                  data-ocid="customer.create_new_button"
                >
                  No, create new
                </Button>
              </div>
            </div>
          )}

          {/* Remaining fields — hidden during dup check */}
          {showForm && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="cust-phone">Phone *</Label>
                <Input
                  id="cust-phone"
                  data-ocid="customer.phone.input"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="+91 98765 43210"
                  required
                />
                {errors.phone && (
                  <p
                    className="text-xs text-destructive"
                    data-ocid="customer.phone.field_error"
                  >
                    {errors.phone}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-email">Email</Label>
                <Input
                  id="cust-email"
                  type="email"
                  data-ocid="customer.email.input"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="priya@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-address">Address</Label>
                <Input
                  id="cust-address"
                  data-ocid="customer.address.input"
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  placeholder="123 Green Lane, Mumbai"
                />
              </div>

              {/* Date of Birth + Gender row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cust-dob" className="text-xs">
                    Date of Birth
                  </Label>
                  <Input
                    id="cust-dob"
                    type="date"
                    className="h-9 text-sm"
                    data-ocid="customer.dob.input"
                    value={form.date_of_birth ?? ""}
                    onChange={(e) =>
                      setField("date_of_birth", e.target.value || undefined)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cust-gender" className="text-xs">
                    Gender
                  </Label>
                  <Select
                    value={form.gender ?? "none"}
                    onValueChange={(v) =>
                      setField("gender", v === "none" ? undefined : v)
                    }
                  >
                    <SelectTrigger
                      id="cust-gender"
                      className="h-9 text-sm"
                      data-ocid="customer.gender.select"
                    >
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Discount section */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5" /> Default Discount
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-discount-type" className="text-xs">
                      Discount Type
                    </Label>
                    <Select
                      value={form.discount_applicable ?? "none"}
                      onValueChange={(v) =>
                        setField(
                          "discount_applicable",
                          v === "none" ? undefined : (v as DiscountType),
                        )
                      }
                    >
                      <SelectTrigger
                        id="cust-discount-type"
                        className="h-8 text-xs"
                        data-ocid="customer.discount_type.select"
                      >
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="Percentage">
                          Percentage (%)
                        </SelectItem>
                        <SelectItem value="Fixed">Fixed Amount (₹)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {showDiscountValue && (
                    <div className="space-y-1.5">
                      <Label htmlFor="cust-discount-value" className="text-xs">
                        {form.discount_applicable === "Percentage"
                          ? "Percentage (%)"
                          : "Amount (₹)"}
                      </Label>
                      <Input
                        id="cust-discount-value"
                        type="number"
                        min={0}
                        max={
                          form.discount_applicable === "Percentage"
                            ? 100
                            : undefined
                        }
                        step={0.01}
                        className="h-8 text-xs"
                        value={form.discount_value ?? ""}
                        onChange={(e) => {
                          const v = Number.parseFloat(e.target.value);
                          setField(
                            "discount_value",
                            Number.isNaN(v) ? undefined : v,
                          );
                        }}
                        placeholder={
                          form.discount_applicable === "Percentage"
                            ? "10"
                            : "50"
                        }
                        data-ocid="customer.discount_value.input"
                      />
                      {errors.discount_value && (
                        <p className="text-xs text-destructive">
                          {errors.discount_value}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="cust-notes">Notes</Label>
                <Textarea
                  id="cust-notes"
                  data-ocid="customer.notes.textarea"
                  value={form.notes ?? ""}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="Interaction notes, preferences, etc."
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  data-ocid="customer.cancel_button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  data-ocid="customer.submit_button"
                >
                  {loading ? "Saving…" : editing ? "Update" : "Add Customer"}
                </Button>
              </DialogFooter>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Customer Order History (rich) ───────────────────────────────────────────

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "bg-primary/10 text-primary border-primary/30",
  unpaid: "bg-destructive/10 text-destructive border-destructive/30",
  partial: "bg-accent/20 text-accent-foreground border-accent/40",
};

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

function CustomerOrderHistory({ customer }: { customer: CustomerPublic }) {
  const { data: orders = [], isLoading } = useGetCustomerOrders(customer.id);

  const lifetimeRevenue = orders.reduce((sum, o) => sum + o.total_revenue, 0);
  const lastPurchase =
    orders.length > 0
      ? orders.reduce(
          (latest, o) =>
            Number(o.timestamp) > Number(latest) ? o.timestamp : latest,
          BigInt(0),
        )
      : null;

  if (isLoading) {
    return (
      <div className="space-y-3 py-2" data-ocid="customer.orders.loading_state">
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-3 py-8 text-muted-foreground"
        data-ocid="customer.orders.empty_state"
      >
        <ShoppingBag className="w-10 h-10 opacity-30" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            No purchase history
          </p>
          <p className="text-xs mt-0.5">Orders will appear here once placed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Revenue summary strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted/40 p-2.5">
          <p className="text-xs text-muted-foreground mb-0.5">Total Orders</p>
          <p className="text-lg font-semibold tabular-nums">{orders.length}</p>
        </div>
        <div className="rounded-lg bg-primary/5 p-2.5">
          <p className="text-xs text-muted-foreground mb-0.5">Revenue</p>
          <p className="text-sm font-semibold text-primary tabular-nums truncate">
            {formatCurrency(lifetimeRevenue)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2.5">
          <p className="text-xs text-muted-foreground mb-0.5">Last Purchase</p>
          <p className="text-xs font-medium">
            {lastPurchase ? formatDate(lastPurchase) : "—"}
          </p>
        </div>
      </div>

      {/* Chronological order list */}
      <div className="space-y-3">
        {[...orders]
          .sort(
            (a: CustomerOrderFlat, b: CustomerOrderFlat) =>
              Number(b.timestamp) - Number(a.timestamp),
          )
          .map((order: CustomerOrderFlat, idx: number) => {
            const paymentStatus = order.payment_status ?? "paid";
            const paymentMode = order.payment_mode;
            return (
              <div
                key={order.sale_id.toString()}
                className="rounded-lg border border-border bg-card p-3 stagger-item space-y-2"
                style={{ animationDelay: `${idx * 0.06}s` }}
                data-ocid={`customer.orders.item.${idx + 1}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">
                        Order #{order.sale_id.toString()}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PAYMENT_STATUS_COLORS[paymentStatus] ?? PAYMENT_STATUS_COLORS.paid}`}
                      >
                        {paymentStatus.charAt(0).toUpperCase() +
                          paymentStatus.slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateFull(order.timestamp)}
                    </p>
                    {paymentMode && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <CreditCard className="w-3 h-3" />{" "}
                        {PAYMENT_MODE_LABELS[paymentMode] ?? paymentMode}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-sm font-semibold text-primary">
                      {formatCurrency(order.total_revenue)}
                    </p>
                    {(order.discount_applied ?? 0) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        -{formatCurrency(order.discount_applied ?? 0)} disc.
                      </p>
                    )}
                    {(order.balance_due ?? 0) > 0 && (
                      <p className="text-xs text-destructive">
                        Due: {formatCurrency(order.balance_due ?? 0)}
                      </p>
                    )}
                  </div>
                </div>
                {order.items && order.items.length > 0 && (
                  <div className="border-t border-border pt-2 space-y-1">
                    {order.items.slice(0, 3).map((item, iIdx) => (
                      <div
                        key={iIdx.toString()}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Package className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate text-foreground">
                            {item.product_name}
                          </span>
                          <span className="text-muted-foreground flex-shrink-0">
                            ×{Number(item.quantity)}
                          </span>
                        </div>
                        <span className="text-muted-foreground flex-shrink-0">
                          {formatCurrency(
                            item.actual_sale_price * Number(item.quantity),
                          )}
                        </span>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{order.items.length - 3} more items
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─── Customer Detail Sheet ────────────────────────────────────────────────────

interface CustomerDetailSheetProps {
  customer: CustomerPublicWithDiscount | null;
  onClose: () => void;
  onEdit: (c: CustomerPublicWithDiscount) => void;
  canEdit: boolean;
}

function CustomerDetailSheet({
  customer,
  onClose,
  onEdit,
  canEdit,
}: CustomerDetailSheetProps) {
  const [activeTab, setActiveTab] = useState("info");

  return (
    <Sheet open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="w-full sm:max-w-lg overflow-y-auto"
        data-ocid="customer.detail.sheet"
      >
        {customer && (
          <>
            <SheetHeader className="pb-4 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="text-left truncate">
                      {customer.name}
                    </SheetTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Customer since {formatDate(customer.created_at)}
                    </p>
                  </div>
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(customer)}
                    data-ocid="customer.detail.edit_button"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Edit
                  </Button>
                )}
              </div>
            </SheetHeader>

            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 py-4 border-b border-border">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground mb-1">
                  Total Sales
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {customer.total_sales.toString()}
                </p>
              </div>
              <div className="rounded-lg bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground mb-1">
                  Lifetime Revenue
                </p>
                <p className="text-lg font-semibold text-primary tabular-nums truncate">
                  {formatCurrency(customer.lifetime_revenue)}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="mt-4"
            >
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger
                  value="info"
                  className="text-xs"
                  data-ocid="customer.detail.info_tab"
                >
                  <User className="w-3.5 h-3.5 mr-1" /> Info
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="text-xs"
                  data-ocid="customer.detail.history_tab"
                >
                  <Clock className="w-3.5 h-3.5 mr-1" /> History
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="text-xs"
                  data-ocid="customer.detail.notes_tab"
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-1" /> Notes
                </TabsTrigger>
                <TabsTrigger
                  value="body"
                  className="text-xs"
                  data-ocid="customer.detail.body_tab"
                >
                  <Activity className="w-3.5 h-3.5 mr-1" /> Body
                </TabsTrigger>
              </TabsList>

              {/* Info tab */}
              <TabsContent value="info" className="pt-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Contact
                </h3>
                <div className="flex items-center gap-2.5 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{customer.phone || "—"}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="break-all">{customer.email || "—"}</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{customer.address || "—"}</span>
                </div>

                {/* Date of Birth & Gender */}
                {(customer.date_of_birth || customer.gender) && (
                  <div className="pt-2 border-t border-border space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Personal
                    </h3>
                    {customer.date_of_birth && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <span className="text-muted-foreground text-xs w-20 shrink-0">
                          Date of Birth
                        </span>
                        <span>{customer.date_of_birth}</span>
                      </div>
                    )}
                    {customer.gender && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <span className="text-muted-foreground text-xs w-20 shrink-0">
                          Gender
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {customer.gender}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}

                {customer.discount_applicable &&
                  customer.discount_value !== undefined &&
                  customer.discount_value > 0 && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Default Discount
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 flex items-center gap-2">
                          <Percent className="w-4 h-4 text-primary" />
                          <span className="text-sm font-semibold text-primary">
                            {customer.discount_applicable === "Percentage"
                              ? `${customer.discount_value}% off`
                              : `₹${customer.discount_value} off`}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Applied automatically on sales
                        </span>
                      </div>
                    </div>
                  )}
              </TabsContent>

              {/* History tab */}
              <TabsContent value="history" className="pt-4">
                <CustomerOrderHistory customer={customer} />
              </TabsContent>

              {/* Notes tab */}
              <TabsContent value="notes" className="pt-4 space-y-3">
                {customer.notesText && (
                  <div
                    className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm text-foreground whitespace-pre-wrap"
                    data-ocid="customer.notes.item.1"
                  >
                    {customer.notesText}
                  </div>
                )}
                {!customer.notesText && (
                  <p
                    className="text-xs text-muted-foreground italic"
                    data-ocid="customer.notes.empty_state"
                  >
                    No notes yet.
                  </p>
                )}
              </TabsContent>

              {/* Body Composition tab */}
              <TabsContent value="body" className="pt-4">
                <BodyCompositionTab customer={customer} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

type SortKey = "name" | "total_sales" | "lifetime_revenue" | "last_purchase_at";
type SortDir = "asc" | "desc";

function SortIcon({
  col,
  sortKey,
  sortDir,
}: {
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
}) {
  if (col !== sortKey)
    return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />;
  return sortDir === "asc" ? (
    <ChevronUp className="w-3.5 h-3.5" />
  ) : (
    <ChevronDown className="w-3.5 h-3.5" />
  );
}

// ─── Customer List ────────────────────────────────────────────────────────────

interface CustomerListProps {
  customers: CustomerPublicWithDiscount[];
  isLoading: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onViewDetail: (c: CustomerPublicWithDiscount) => void;
  onEdit: (c: CustomerPublicWithDiscount) => void;
  onDelete: (c: CustomerPublicWithDiscount) => void;
}

function CustomerList({
  customers,
  isLoading,
  canEdit,
  canDelete,
  onViewDetail,
  onEdit,
  onDelete,
}: CustomerListProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...customers].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") cmp = a.name.localeCompare(b.name);
    else if (sortKey === "total_sales")
      cmp = Number(a.total_sales) - Number(b.total_sales);
    else if (sortKey === "lifetime_revenue")
      cmp = a.lifetime_revenue - b.lifetime_revenue;
    else if (sortKey === "last_purchase_at")
      cmp = Number(a.last_purchase_at) - Number(b.last_purchase_at);
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (isLoading) {
    return (
      <div
        className="rounded-lg border border-border overflow-hidden"
        data-ocid="customers.loading_state"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {[
                  "Customer",
                  "Contact",
                  "Discount",
                  "Sales",
                  "Revenue",
                  "Last Purchase",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-medium text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </td>
                  {[1, 2, 3, 4, 5].map((j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-20" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-3 py-16 text-muted-foreground"
        data-ocid="customers.empty_state"
      >
        <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center">
          <Users className="w-7 h-7 opacity-40" />
        </div>
        <div className="text-center">
          <p className="font-medium text-foreground">No customers yet</p>
          <p className="text-xs mt-0.5">
            Add your first customer to start managing sales
          </p>
        </div>
      </div>
    );
  }

  const thCls = "px-4 py-3 font-medium text-muted-foreground whitespace-nowrap";
  const sortBtnCls =
    "flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none";

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table
          className="w-full text-sm min-w-[680px]"
          data-ocid="customers.table"
        >
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className={`${thCls} text-left`}>
                <button
                  type="button"
                  className={sortBtnCls}
                  onClick={() => toggleSort("name")}
                >
                  Customer{" "}
                  <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
                </button>
              </th>
              <th className={`${thCls} text-left hidden md:table-cell`}>
                Contact
              </th>
              <th className={`${thCls} text-left hidden sm:table-cell`}>
                Discount
              </th>
              <th className={`${thCls} text-right`}>
                <button
                  type="button"
                  className={`${sortBtnCls} ml-auto`}
                  onClick={() => toggleSort("total_sales")}
                >
                  <SortIcon
                    col="total_sales"
                    sortKey={sortKey}
                    sortDir={sortDir}
                  />{" "}
                  Sales
                </button>
              </th>
              <th className={`${thCls} text-right`}>
                <button
                  type="button"
                  className={`${sortBtnCls} ml-auto`}
                  onClick={() => toggleSort("lifetime_revenue")}
                >
                  <SortIcon
                    col="lifetime_revenue"
                    sortKey={sortKey}
                    sortDir={sortDir}
                  />{" "}
                  Revenue
                </button>
              </th>
              <th className={`${thCls} text-right hidden sm:table-cell`}>
                <button
                  type="button"
                  className={`${sortBtnCls} ml-auto`}
                  onClick={() => toggleSort("last_purchase_at")}
                >
                  <SortIcon
                    col="last_purchase_at"
                    sortKey={sortKey}
                    sortDir={sortDir}
                  />{" "}
                  Last Purchase
                </button>
              </th>
              <th className={`${thCls} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((customer, idx) => (
              <tr
                key={customer.id.toString()}
                className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer stagger-item"
                style={{ animationDelay: `${idx * 0.04}s` }}
                onClick={() => onViewDetail(customer)}
                onKeyDown={(e) => e.key === "Enter" && onViewDetail(customer)}
                tabIndex={0}
                data-ocid={`customers.item.${idx + 1}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-primary">
                        {customer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{customer.name}</p>
                      {customer.email && (
                        <p className="text-xs text-muted-foreground truncate hidden sm:block">
                          {customer.email}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                  {customer.phone || "—"}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <DiscountBadge
                    discount_applicable={customer.discount_applicable}
                    discount_value={customer.discount_value}
                  />
                  {!customer.discount_applicable && (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <Badge variant="secondary" className="text-xs">
                    {customer.total_sales.toString()}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-primary">
                  {formatCurrency(customer.lifetime_revenue)}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                  {formatDate(customer.last_purchase_at)}
                </td>
                <td className="px-4 py-3">
                  <div
                    className="flex items-center justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => onEdit(customer)}
                        aria-label="Edit customer"
                        data-ocid={`customers.edit_button.${idx + 1}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDelete(customer)}
                        aria-label="Delete customer"
                        data-ocid={`customers.delete_button.${idx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CustomersPage({ onNavigate: _onNavigate }: CustomersPageProps) {
  const { userProfile } = useProfile();
  const { data: rawCustomers = [], isLoading } = useGetCustomers();
  const deleteCustomer = useDeleteCustomer();

  // discount_applicable and discount_value come directly from backend CustomerPublic
  const customers: CustomerPublicWithDiscount[] = rawCustomers.map((c) => {
    // Merge locally stored notes with backend notes array for backward compatibility
    const stored = getStoredCustomerDiscount(c.id.toString());
    const notesText = c.notes.length > 0 ? c.notes[0] : stored.notes;
    return { ...c, notesText };
  });

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerPublicWithDiscount | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] =
    useState<CustomerPublicWithDiscount | null>(null);
  const [detailCustomer, setDetailCustomer] =
    useState<CustomerPublicWithDiscount | null>(null);

  const role = userProfile?.role as string | undefined;
  // Staff (formerly Sub-Admin) can also edit/delete customers per requirements
  const canEdit =
    role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN || role === ROLES.STAFF;
  const canDelete =
    role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN || role === ROLES.STAFF;

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(c: CustomerPublicWithDiscount) {
    setEditing(c);
    setDetailCustomer(null);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCustomer.mutateAsync(deleteTarget.id);
      clearStoredCustomerDiscount(deleteTarget.id.toString());
      toast.success(`"${deleteTarget.name}" deleted`);
    } catch {
      toast.error("Failed to delete customer");
    } finally {
      setDeleteTarget(null);
    }
  }

  const totalRevenue = customers.reduce(
    (sum, c) => sum + c.lifetime_revenue,
    0,
  );
  const totalSales = customers.reduce(
    (sum, c) => sum + Number(c.total_sales),
    0,
  );

  return (
    <div className="space-y-6" data-ocid="customers.page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">
            Customers
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your customer base and view purchase history
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={openAdd}
            className="sm:shrink-0"
            data-ocid="customers.add_button"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Customer
          </Button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Users className="w-3.5 h-3.5" />
            Total Customers
          </div>
          <p className="text-2xl font-semibold tabular-nums">
            {isLoading ? (
              <Skeleton className="h-7 w-10 inline-block" />
            ) : (
              customers.length
            )}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <ShoppingBag className="w-3.5 h-3.5" />
            Total Sales
          </div>
          <p className="text-2xl font-semibold tabular-nums">
            {isLoading ? (
              <Skeleton className="h-7 w-10 inline-block" />
            ) : (
              totalSales
            )}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Lifetime Revenue
          </div>
          <p className="text-2xl font-semibold text-primary tabular-nums">
            {isLoading ? (
              <Skeleton className="h-7 w-24 inline-block" />
            ) : (
              formatCurrency(totalRevenue)
            )}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-ocid="customers.search_input"
        />
      </div>

      {/* Customer table */}
      <CustomerList
        customers={filtered}
        isLoading={isLoading}
        canEdit={canEdit}
        canDelete={canDelete}
        onViewDetail={setDetailCustomer}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
      />

      {/* Dialogs */}
      <CustomerDialog
        open={dialogOpen}
        editing={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />

      <CustomerDetailSheet
        customer={detailCustomer}
        onClose={() => setDetailCustomer(null)}
        onEdit={openEdit}
        canEdit={canEdit}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent data-ocid="customer.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget?.name}</strong>? This will permanently
              remove their record and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="customer.delete.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="customer.delete.confirm_button"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
