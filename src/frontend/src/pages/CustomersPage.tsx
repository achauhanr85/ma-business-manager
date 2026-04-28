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
  useAddCustomerNote as useAddCustomerNoteBackend,
  useCheckCustomerDuplicate,
  useCreateBodyInchesEntry as useCreateBodyInchesEntryBackend,
  useCreateCustomer,
  useDeleteCustomer,
  useDeleteCustomerNote as useDeleteCustomerNoteBackend,
  useGetBodyInchesHistory as useGetBodyInchesHistoryBackend,
  useGetCustomerOrders,
  useGetCustomers,
  useGetReferralUsers,
  useGetUsersByProfile,
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
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Clock,
  CreditCard,
  GitBranch,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Pencil,
  Percent,
  Phone,
  Plus,
  Ruler,
  Search,
  ShoppingBag,
  Stethoscope,
  Tag,
  Target,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Variant_active_lead_inactive } from "../backend";
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

/** Calculate age in years from a date string like "YYYY-MM-DD" */
function calcAge(dob: string): number | null {
  if (!dob) return null;
  const ms = Date.now() - new Date(dob).getTime();
  if (ms < 0) return null;
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
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

// ─── Customer Type helpers ────────────────────────────────────────────────────

type CustomerTypeFilter = "all" | "lead" | "active" | "inactive" | "followup";

function CustomerTypeBadge({
  ct,
}: {
  ct: Variant_active_lead_inactive;
}) {
  if (ct === Variant_active_lead_inactive.active) {
    return (
      <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
        Active
      </Badge>
    );
  }
  if (ct === Variant_active_lead_inactive.inactive) {
    return (
      <Badge
        variant="outline"
        className="text-xs text-muted-foreground border-muted-foreground/30"
      >
        Inactive
      </Badge>
    );
  }
  return (
    <Badge className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/20">
      Lead
    </Badge>
  );
}

// ─── Indian Location Master Data ──────────────────────────────────────────────

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

const CITIES_BY_STATE: Record<string, string[]> = {
  Maharashtra: [
    "Mumbai",
    "Pune",
    "Nagpur",
    "Nashik",
    "Aurangabad",
    "Solapur",
    "Thane",
    "Navi Mumbai",
    "Kolhapur",
    "Amravati",
  ],
  Karnataka: [
    "Bengaluru",
    "Mysuru",
    "Hubli",
    "Mangaluru",
    "Belagavi",
    "Ballari",
    "Vijayapura",
    "Shimoga",
    "Tumkur",
    "Davangere",
  ],
  "Tamil Nadu": [
    "Chennai",
    "Coimbatore",
    "Madurai",
    "Tiruchirappalli",
    "Salem",
    "Tirunelveli",
    "Vellore",
    "Erode",
    "Thoothukudi",
    "Dindigul",
  ],
  Gujarat: [
    "Ahmedabad",
    "Surat",
    "Vadodara",
    "Rajkot",
    "Bhavnagar",
    "Jamnagar",
    "Junagadh",
    "Gandhinagar",
    "Anand",
    "Morbi",
  ],
  "Uttar Pradesh": [
    "Lucknow",
    "Kanpur",
    "Agra",
    "Varanasi",
    "Meerut",
    "Allahabad",
    "Bareilly",
    "Aligarh",
    "Moradabad",
    "Ghaziabad",
  ],
  Rajasthan: [
    "Jaipur",
    "Jodhpur",
    "Udaipur",
    "Kota",
    "Bikaner",
    "Ajmer",
    "Bhilwara",
    "Alwar",
    "Bharatpur",
    "Sikar",
  ],
  "Madhya Pradesh": [
    "Bhopal",
    "Indore",
    "Gwalior",
    "Jabalpur",
    "Ujjain",
    "Sagar",
    "Ratlam",
    "Satna",
    "Dewas",
    "Murwara",
  ],
  "West Bengal": [
    "Kolkata",
    "Howrah",
    "Durgapur",
    "Asansol",
    "Siliguri",
    "Bardhaman",
    "Malda",
    "Barasat",
    "Krishnanagar",
    "Haldia",
  ],
  Delhi: [
    "New Delhi",
    "North Delhi",
    "South Delhi",
    "East Delhi",
    "West Delhi",
    "Central Delhi",
  ],
  Kerala: [
    "Thiruvananthapuram",
    "Kochi",
    "Kozhikode",
    "Kollam",
    "Thrissur",
    "Alappuzha",
    "Palakkad",
    "Malappuram",
    "Kannur",
    "Kasaragod",
  ],
  "Andhra Pradesh": [
    "Visakhapatnam",
    "Vijayawada",
    "Guntur",
    "Tirupati",
    "Nellore",
    "Kurnool",
    "Rajahmundry",
    "Kadapa",
    "Kakinada",
    "Anantapur",
  ],
  Telangana: [
    "Hyderabad",
    "Warangal",
    "Nizamabad",
    "Karimnagar",
    "Khammam",
    "Ramagundam",
    "Nalgonda",
    "Adilabad",
    "Suryapet",
    "Siddipet",
  ],
  Punjab: [
    "Ludhiana",
    "Amritsar",
    "Jalandhar",
    "Patiala",
    "Bathinda",
    "Hoshiarpur",
    "Mohali",
    "Pathankot",
    "Moga",
    "Fatehgarh Sahib",
  ],
  Haryana: [
    "Faridabad",
    "Gurgaon",
    "Panipat",
    "Ambala",
    "Yamunanagar",
    "Rohtak",
    "Hisar",
    "Karnal",
    "Sonipat",
    "Panchkula",
  ],
  Bihar: [
    "Patna",
    "Gaya",
    "Bhagalpur",
    "Muzaffarpur",
    "Purnia",
    "Darbhanga",
    "Bihar Sharif",
    "Arrah",
    "Begusarai",
    "Katihar",
  ],
};

const COUNTRIES = [
  "India",
  "Nepal",
  "Sri Lanka",
  "Bangladesh",
  "Pakistan",
  "UAE",
  "USA",
  "UK",
  "Canada",
  "Australia",
  "Other",
];

// ─── Location Dropdown with Add New ──────────────────────────────────────────

interface LocationSelectProps {
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (v: string) => void;
  "data-ocid"?: string;
}

function LocationSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  "data-ocid": dataOcid,
}: LocationSelectProps) {
  const [addingNew, setAddingNew] = useState(false);
  const [newEntry, setNewEntry] = useState("");
  const [customOptions, setCustomOptions] = useState<string[]>([]);
  const allOptions = [...options, ...customOptions];

  function handleAddNew() {
    const trimmed = newEntry.trim();
    if (!trimmed) return;
    if (!allOptions.includes(trimmed)) {
      setCustomOptions((prev) => [...prev, trimmed]);
    }
    onChange(trimmed);
    setAddingNew(false);
    setNewEntry("");
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {addingNew ? (
        <div className="flex gap-1.5">
          <Input
            className="h-9 text-sm flex-1"
            placeholder={`Enter ${label.toLowerCase()}`}
            value={newEntry}
            onChange={(e) => setNewEntry(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddNew();
              }
            }}
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddNew}
            className="h-9 px-2"
          >
            Add
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 px-2"
            onClick={() => {
              setAddingNew(false);
              setNewEntry("");
            }}
          >
            ✕
          </Button>
        </div>
      ) : (
        <Select
          value={value || "none"}
          onValueChange={(v) => {
            if (v === "__add_new__") {
              setAddingNew(true);
            } else {
              onChange(v === "none" ? "" : v);
            }
          }}
        >
          <SelectTrigger className="h-9 text-sm" data-ocid={dataOcid}>
            <SelectValue
              placeholder={placeholder ?? `Select ${label.toLowerCase()}`}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Not specified —</SelectItem>
            {allOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
            <SelectItem
              value="__add_new__"
              className="text-primary font-medium"
            >
              <span className="flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add new…
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
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

// ─── Goal / Medical Issue Master Types ───────────────────────────────────────

interface GoalMaster {
  id: bigint;
  name: string;
  description: string;
  product_bundle: bigint[];
}

interface MedicalIssueMaster {
  id: bigint;
  name: string;
  description: string;
}

// ─── Customer Note Type (multi-note) ─────────────────────────────────────────

interface CustomerNote {
  id: bigint;
  text: string;
  note_date: bigint;
  created_by: string;
  creation_date: bigint;
}

// ─── Goal Master Hooks (local) ────────────────────────────────────────────────

function useGetGoalMasterData(profileKey: string | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<GoalMaster[]>({
    queryKey: ["goal-master-data", profileKey],
    queryFn: async () => {
      if (!actor || !profileKey) return [];
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.getGoalMasterData !== "function") return [];
      return (a.getGoalMasterData as (pk: string) => Promise<GoalMaster[]>)(
        profileKey,
      );
    },
    enabled: !!actor && !isFetching && !!profileKey,
  });
}

function useCreateGoalMaster() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileKey,
      input,
    }: {
      profileKey: string;
      input: { name: string; description: string; product_bundle: bigint[] };
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.createGoalMaster !== "function")
        throw new Error("createGoalMaster not available");
      return (
        a.createGoalMaster as (
          pk: string,
          inp: { name: string; description: string; product_bundle: bigint[] },
        ) => Promise<bigint>
      )(profileKey, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goal-master-data"] });
    },
  });
}

// ─── Medical Issue Master Hooks (local) ──────────────────────────────────────

function useGetMedicalIssueMasterData(profileKey: string | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<MedicalIssueMaster[]>({
    queryKey: ["medical-issue-master-data", profileKey],
    queryFn: async () => {
      if (!actor || !profileKey) return [];
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.getMedicalIssueMasterData !== "function") return [];
      return (
        a.getMedicalIssueMasterData as (
          pk: string,
        ) => Promise<MedicalIssueMaster[]>
      )(profileKey);
    },
    enabled: !!actor && !isFetching && !!profileKey,
  });
}

function useCreateMedicalIssueMaster() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileKey,
      input,
    }: {
      profileKey: string;
      input: { name: string; description: string };
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.createMedicalIssueMaster !== "function")
        throw new Error("createMedicalIssueMaster not available");
      return (
        a.createMedicalIssueMaster as (
          pk: string,
          inp: { name: string; description: string },
        ) => Promise<bigint>
      )(profileKey, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medical-issue-master-data"] });
    },
  });
}

// ─── Body Inches Hooks (re-exported from useBackend with profile-aware wrapper) ─

// These are thin UI adapters over the real hooks in useBackend.ts.
// useGetBodyInchesHistoryBackend and useCreateBodyInchesEntryBackend are imported above.

// Local adapter that maps the old { id, customerId } shape to the real hook
function useDeleteBodyInchesEntry() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      customerId: _customerId,
      profileKey: _profileKey,
    }: {
      id: string;
      customerId: CustomerId;
      profileKey: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.deleteBodyInchesEntry !== "function")
        throw new Error("deleteBodyInchesEntry not available");
      return (a.deleteBodyInchesEntry as (id: string) => Promise<boolean>)(id);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: [
          "body-inches-history",
          variables.customerId.toString(),
          variables.profileKey,
        ],
      });
    },
  });
}

// ─── Body Composition Entry Form (inline or standalone dialog) ────────────────

const EMPTY_BODY_COMP: BodyCompositionInput = { date: "" };

/** Shared body composition field grid used in both dialog and inline form */
function BodyCompFields({
  form,
  onChange,
}: {
  form: BodyCompositionInput;
  onChange: (updated: BodyCompositionInput) => void;
}) {
  function numField(
    key: keyof Omit<BodyCompositionInput, "date" | "body_age">,
    value: string,
  ) {
    const v = value === "" ? undefined : Number.parseFloat(value);
    onChange({ ...form, [key]: v });
  }

  function bodyAgeField(value: string) {
    const v = value === "" ? undefined : BigInt(Math.round(Number(value)));
    onChange({ ...form, body_age: v });
  }

  const fieldCls = "space-y-1.5";
  const inputCls = "h-8 text-xs";

  return (
    <div className="space-y-3">
      <div className={fieldCls}>
        <Label htmlFor="bc-date" className="text-xs">
          Date *
        </Label>
        <Input
          id="bc-date"
          type="date"
          className={inputCls}
          value={form.date}
          onChange={(e) => onChange({ ...form, date: e.target.value })}
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
          ] as [keyof Omit<BodyCompositionInput, "date" | "body_age">, string][]
        ).map(([key, label]) => (
          <div key={key} className={fieldCls}>
            <Label htmlFor={`bc-${key}`} className="text-xs">
              {label}
            </Label>
            <Input
              id={`bc-${key}`}
              type="number"
              step="0.01"
              className={inputCls}
              value={form[key] !== undefined ? String(form[key]) : ""}
              onChange={(e) => numField(key, e.target.value)}
              data-ocid={`body_composition.${key}.input`}
            />
          </div>
        ))}
        {/* Muscle Mass — allows negative */}
        <div className={fieldCls}>
          <Label htmlFor="bc-muscle_mass" className="text-xs">
            Muscle Mass (kg)
          </Label>
          <Input
            id="bc-muscle_mass"
            type="number"
            step="any"
            className={inputCls}
            value={
              form.muscle_mass !== undefined ? String(form.muscle_mass) : ""
            }
            onChange={(e) => numField("muscle_mass", e.target.value)}
            data-ocid="body_composition.muscle_mass.input"
          />
        </div>
        {/* Body Age */}
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
    </div>
  );
}

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
          <BodyCompFields form={form} onChange={setForm} />
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

  // Sort ALL entries by date descending (latest first)
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

// ─── Body Inches Tab ──────────────────────────────────────────────────────────

// Local form state shape for the add dialog
interface BodyInchesFormState {
  date: string;
  chest?: number;
  biceps?: number;
  waist?: number;
  hips?: number;
  thighs?: number;
  calves?: number;
}

const EMPTY_BODY_INCHES: BodyInchesFormState = { date: "" };

interface BodyInchesAddDialogProps {
  open: boolean;
  customerId: CustomerId;
  profileKey: string;
  onClose: () => void;
}

function BodyInchesAddDialog({
  open,
  customerId,
  profileKey,
  onClose,
}: BodyInchesAddDialogProps) {
  const createEntry = useCreateBodyInchesEntryBackend();
  const [form, setForm] = useState<BodyInchesFormState>(EMPTY_BODY_INCHES);

  useEffect(() => {
    if (open) setForm({ date: new Date().toISOString().split("T")[0] });
  }, [open]);

  function numField(
    key: keyof Omit<BodyInchesFormState, "date">,
    value: string,
  ) {
    const v = value === "" ? undefined : Number.parseFloat(value);
    setForm((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date) {
      toast.error("Date is required");
      return;
    }
    // Convert YYYY-MM-DD string to nanosecond bigint timestamp
    const entryDate = BigInt(new Date(form.date).getTime()) * BigInt(1_000_000);
    try {
      await createEntry.mutateAsync({
        customerId,
        profileKey,
        entryDate,
        chest: form.chest,
        biceps: form.biceps,
        waist: form.waist,
        hips: form.hips,
        thighs: form.thighs,
        calves: form.calves,
      });
      toast.success("Body inches entry saved");
      onClose();
    } catch {
      toast.error("Failed to save entry");
    }
  }

  const INCH_FIELDS: [keyof Omit<BodyInchesFormState, "date">, string][] = [
    ["chest", "Chest (in)"],
    ["biceps", "Biceps (in)"],
    ["waist", "Waist (in)"],
    ["hips", "Hips (in)"],
    ["thighs", "Thighs (in)"],
    ["calves", "Calves (in)"],
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" data-ocid="body_inches.add.dialog">
        <DialogHeader>
          <DialogTitle>Add Body Inches Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bi-date" className="text-xs">
              Date *
            </Label>
            <Input
              id="bi-date"
              type="date"
              className="h-8 text-xs"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              required
              data-ocid="body_inches.date.input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {INCH_FIELDS.map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`bi-${key}`} className="text-xs">
                  {label}
                </Label>
                <Input
                  id={`bi-${key}`}
                  type="number"
                  step="0.1"
                  min={0}
                  className="h-8 text-xs"
                  value={form[key] !== undefined ? String(form[key]) : ""}
                  onChange={(e) => numField(key, e.target.value)}
                  data-ocid={`body_inches.${key}.input`}
                />
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-ocid="body_inches.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createEntry.isPending}
              data-ocid="body_inches.save_button"
            >
              {createEntry.isPending ? "Saving…" : "Save Entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BodyInchesTab({
  customer,
  profileKey,
}: {
  customer: CustomerPublic;
  profileKey: string;
}) {
  const { data: entries = [], isLoading } = useGetBodyInchesHistoryBackend(
    customer.id,
    profileKey,
  );
  const deleteEntry = useDeleteBodyInchesEntry();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // The backend BodyInchesEntry uses entry_date (bigint ns) for sorting; fall back to id string
  const sorted = [...entries].sort((a, b) => {
    const da = Number(a.entry_date ?? BigInt(0));
    const db = Number(b.entry_date ?? BigInt(0));
    return db - da;
  });

  function fmt(v: number | null | undefined): string {
    if (v === undefined || v === null) return "—";
    return v.toFixed(1);
  }

  // Format a nanosecond bigint date to YYYY-MM-DD
  function fmtDate(ns: bigint | undefined): string {
    if (!ns || ns === BigInt(0)) return "—";
    return new Date(Number(ns) / 1_000_000).toISOString().split("T")[0];
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteEntry.mutateAsync({
        id: deleteTarget,
        customerId: customer.id,
        profileKey,
      });
      toast.success("Entry deleted");
    } catch {
      toast.error("Failed to delete entry");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4" data-ocid="customer.body_inches.panel">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {entries.length} {entries.length === 1 ? "entry" : "entries"} recorded
        </p>
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          data-ocid="body_inches.add_button"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Entry
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2" data-ocid="body_inches.loading_state">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div
          className="flex flex-col items-center gap-3 py-8 text-muted-foreground"
          data-ocid="body_inches.empty_state"
        >
          <Ruler className="w-10 h-10 opacity-30" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              No body inches data
            </p>
            <p className="text-xs mt-0.5">
              Add an entry to track body measurements over time
            </p>
          </div>
        </div>
      )}

      {!isLoading && sorted.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table
              className="w-full text-xs min-w-[520px]"
              data-ocid="body_inches.table"
            >
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {[
                    "Date",
                    "Chest",
                    "Biceps",
                    "Waist",
                    "Hips",
                    "Thighs",
                    "Calves",
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
                    key={entry.id.toString()}
                    className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors"
                    data-ocid={`body_inches.item.${idx + 1}`}
                  >
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {fmtDate(entry.entry_date ?? BigInt(0))}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmt(entry.chest)}"
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmt(entry.biceps)}"
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmt(entry.waist)}"
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmt(entry.hips)}"
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmt(entry.thighs)}"
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmt(entry.calves)}"
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(entry.id.toString())}
                        aria-label="Delete entry"
                        data-ocid={`body_inches.delete_button.${idx + 1}`}
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

      <BodyInchesAddDialog
        open={addOpen}
        customerId={customer.id}
        profileKey={profileKey}
        onClose={() => setAddOpen(false)}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent data-ocid="body_inches.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This body inches entry will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="body_inches.delete.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="body_inches.delete.confirm_button"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Multi-Note Panel (used in Info tab and create form) ─────────────────────

interface NotesManagerProps {
  customer: CustomerPublicWithDiscount;
  canEdit: boolean;
  profileKey: string;
}

function NotesManager({ customer, canEdit, profileKey }: NotesManagerProps) {
  const addNote = useAddCustomerNoteBackend();
  const deleteNote = useDeleteCustomerNoteBackend();
  const [addOpen, setAddOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteDate, setNewNoteDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [deleteNoteId, setDeleteNoteId] = useState<bigint | null>(null);

  // Gracefully handle both legacy string[] notes and new structured notes
  const rawNotes = customer.notes as unknown as (CustomerNote | string)[];
  const structuredNotes: CustomerNote[] = rawNotes
    .map((n, idx): CustomerNote | null => {
      if (typeof n === "string") {
        return {
          id: BigInt(idx),
          text: n,
          note_date: BigInt(0),
          created_by: "",
          creation_date: BigInt(0),
        };
      }
      return n as CustomerNote;
    })
    .filter(Boolean) as CustomerNote[];

  // Sort latest first
  const sorted = [...structuredNotes].sort((a, b) => {
    const da = Number(a.note_date) || Number(a.creation_date);
    const db = Number(b.note_date) || Number(b.creation_date);
    return db - da;
  });

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    // Convert YYYY-MM-DD string to nanosecond bigint timestamp
    const noteDateNs =
      BigInt(new Date(newNoteDate).getTime()) * BigInt(1_000_000);
    try {
      await addNote.mutateAsync({
        customerId: customer.id,
        profileKey,
        text: newNoteText.trim(),
        noteDate: noteDateNs,
      });
      toast.success("Note added");
      setNewNoteText("");
      setNewNoteDate(new Date().toISOString().split("T")[0]);
      setAddOpen(false);
    } catch {
      toast.error("Failed to add note");
    }
  }

  async function handleDeleteNote() {
    if (deleteNoteId === null) return;
    try {
      await deleteNote.mutateAsync({
        customerId: customer.id,
        noteId: deleteNoteId,
        profileKey,
      });
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    } finally {
      setDeleteNoteId(null);
    }
  }

  return (
    <div className="space-y-3" data-ocid="customer.notes.panel">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" /> Notes
        </p>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2"
            onClick={() => setAddOpen(true)}
            data-ocid="customer.notes.add_button"
          >
            <Plus className="w-3 h-3 mr-1" /> Add Note
          </Button>
        )}
      </div>

      {addOpen && (
        <form
          onSubmit={handleAddNote}
          className="rounded-lg border border-border bg-muted/20 p-3 space-y-2"
          data-ocid="customer.notes.add_form"
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={newNoteDate}
                onChange={(e) => setNewNoteDate(e.target.value)}
                data-ocid="customer.notes.date.input"
              />
            </div>
          </div>
          <Textarea
            className="text-xs min-h-[60px] resize-none"
            placeholder="Write a note…"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            data-ocid="customer.notes.text.textarea"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2"
              onClick={() => {
                setAddOpen(false);
                setNewNoteText("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-7 text-xs px-3"
              disabled={addNote.isPending || !newNoteText.trim()}
              data-ocid="customer.notes.submit_button"
            >
              {addNote.isPending ? "Saving…" : "Save Note"}
            </Button>
          </div>
        </form>
      )}

      {sorted.length === 0 && !addOpen && (
        <p
          className="text-xs text-muted-foreground italic"
          data-ocid="customer.notes.empty_state"
        >
          No notes yet.
        </p>
      )}

      {sorted.map((note, idx) => (
        <div
          key={note.id.toString()}
          className="rounded-lg bg-muted/30 border border-border px-3 py-2 space-y-1"
          data-ocid={`customer.notes.item.${idx + 1}`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {note.note_date && Number(note.note_date) > 0
                ? new Date(Number(note.note_date) / 1_000_000)
                    .toISOString()
                    .split("T")[0]
                : note.creation_date && Number(note.creation_date) > 0
                  ? new Date(Number(note.creation_date) / 1_000_000)
                      .toISOString()
                      .split("T")[0]
                  : "—"}
            </p>
            {canEdit && (
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-destructive hover:text-destructive"
                onClick={() => setDeleteNoteId(note.id)}
                aria-label="Delete note"
                data-ocid={`customer.notes.delete_button.${idx + 1}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {note.text}
          </p>
        </div>
      ))}

      <AlertDialog
        open={deleteNoteId !== null}
        onOpenChange={(o) => !o && setDeleteNoteId(null)}
      >
        <AlertDialogContent data-ocid="customer.notes.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note?</AlertDialogTitle>
            <AlertDialogDescription>
              This note will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="customer.notes.delete.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="customer.notes.delete.confirm_button"
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
  address_line1: "",
  address_line2: "",
  state: "",
  city: "",
  country: "India",
  pin_code: "",
  height: "",
  discount_applicable: undefined,
  discount_value: undefined,
  notes: "",
  date_of_birth: undefined,
  gender: undefined,
  customer_created_by: undefined,
  referred_by: undefined,
  referral_commission_amount: undefined,
  customer_type: Variant_active_lead_inactive.lead,
  lead_follow_up_date: undefined,
  lead_notes: undefined,
};

type DuplicateState =
  | { step: "idle" }
  | { step: "checking" }
  | { step: "found"; similar_name: string; existing_id: bigint }
  | { step: "confirmed_new" };

function CustomerDialog({ open, editing, onClose }: CustomerDialogProps) {
  const { userProfile } = useProfile();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const checkDuplicate = useCheckCustomerDuplicate();
  const createBodyComp = useCreateBodyCompositionEntry();

  // Fetch all profile users for the "Created By" dropdown
  const profileKey = userProfile?.profile_key ?? null;
  const { data: profileUsers = [] } = useGetUsersByProfile(profileKey);

  // Fetch referral users for the "Referred By" dropdown
  const { data: referralUsers = [] } = useGetReferralUsers(profileKey);

  // Fetch goals and medical issues for multi-select
  const { data: allGoals = [] } = useGetGoalMasterData(profileKey);
  const { data: allIssues = [] } = useGetMedicalIssueMasterData(profileKey);
  const createGoal = useCreateGoalMaster();
  const createIssue = useCreateMedicalIssueMaster();

  // Auto-select logged-in user as "Referred By" if they are a referral user
  const currentUserIsReferral =
    (userProfile?.role as string) === "referralUser";
  const currentUserDisplayName = userProfile?.display_name ?? "";

  const [form, setForm] = useState<CustomerInputExtended>(EMPTY_FORM);
  const [selectedGoalIds, setSelectedGoalIds] = useState<bigint[]>([]);
  const [selectedIssueIds, setSelectedIssueIds] = useState<bigint[]>([]);
  const [goalSearch, setGoalSearch] = useState("");
  const [issueSearch, setIssueSearch] = useState("");
  const [newGoalName, setNewGoalName] = useState("");
  const [newIssueName, setNewIssueName] = useState("");
  const [addingGoal, setAddingGoal] = useState(false);
  const [addingIssue, setAddingIssue] = useState(false);

  const [errors, setErrors] = useState<
    Partial<Record<keyof CustomerInputExtended, string>>
  >({});
  const [dupState, setDupState] = useState<DuplicateState>({ step: "idle" });
  const [bodyCompOpen, setBodyCompOpen] = useState(false);
  const [bodyCompForm, setBodyCompForm] = useState<BodyCompositionInput>({
    date: new Date().toISOString().split("T")[0],
  });
  const [hasBodyComp, setHasBodyComp] = useState(false);
  const nameCheckedRef = useRef<string>("");

  useEffect(() => {
    if (open) {
      if (editing) {
        const ext = editing as CustomerPublicWithDiscount;
        const raw = ext as typeof ext & {
          primary_goal_ids?: bigint[];
          medical_issue_ids?: bigint[];
        };
        setSelectedGoalIds(raw.primary_goal_ids ?? []);
        setSelectedIssueIds(raw.medical_issue_ids ?? []);
        setForm({
          name: ext.name,
          phone: ext.phone,
          email: ext.email,
          address: ext.address,
          address_line1: ext.address_line1 ?? "",
          address_line2: ext.address_line2 ?? "",
          state: ext.state ?? "",
          city: ext.city ?? "",
          country: ext.country ?? "India",
          pin_code: ext.pin_code ?? "",
          height: ext.height ?? "",
          discount_applicable: ext.discount_applicable,
          discount_value: ext.discount_value,
          notes: ext.notesText ?? "",
          date_of_birth: ext.date_of_birth ?? "",
          gender: ext.gender ?? "",
          // Populate customer_created_by from existing customer data
          customer_created_by:
            ext.customer_created_by ?? userProfile?.principal,
          // Preserve referral fields
          referred_by: ext.referred_by,
          referral_commission_amount: ext.referral_commission_amount,
          // Customer type + lead fields
          customer_type: ext.customer_type ?? Variant_active_lead_inactive.lead,
          lead_follow_up_date: ext.lead_follow_up_date,
          lead_notes: ext.lead_notes,
        });
      } else {
        setSelectedGoalIds([]);
        setSelectedIssueIds([]);
        setForm({
          ...EMPTY_FORM,
          // Default "Created By" to current user
          customer_created_by: userProfile?.principal,
          // Default "Referred By" to current user if they are a referral user
          referred_by: currentUserIsReferral
            ? currentUserDisplayName
            : undefined,
        });
        setBodyCompForm({ date: new Date().toISOString().split("T")[0] });
        setHasBodyComp(false);
      }
      setGoalSearch("");
      setIssueSearch("");
      setNewGoalName("");
      setNewIssueName("");
      setAddingGoal(false);
      setAddingIssue(false);
      setErrors({});
      setDupState({ step: "idle" });
      setBodyCompOpen(false);
      nameCheckedRef.current = "";
    }
  }, [
    editing,
    open,
    userProfile?.principal,
    currentUserIsReferral,
    currentUserDisplayName,
  ]);

  function setField<K extends keyof CustomerInputExtended>(
    key: K,
    value: CustomerInputExtended[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (key === "name" && dupState.step !== "idle") {
      setDupState({ step: "idle" });
    }
    // When state changes, clear city
    if (key === "state") {
      setForm((prev) => ({ ...prev, state: value as string, city: "" }));
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

  // Build formatted address string for backward-compat address field
  function buildAddressString(): string {
    const parts = [
      form.address_line1,
      form.address_line2,
      form.city,
      form.state,
      form.pin_code,
      form.country,
    ]
      .map((p) => (p ?? "").trim())
      .filter(Boolean);
    return parts.join(", ");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const customerInput = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: buildAddressString() || form.address.trim(),
      ...(form.address_line1 && { address_line1: form.address_line1.trim() }),
      ...(form.address_line2 && { address_line2: form.address_line2.trim() }),
      ...(form.state && { state: form.state }),
      ...(form.city && { city: form.city }),
      ...(form.country && { country: form.country }),
      ...(form.pin_code && { pin_code: form.pin_code.trim() }),
      ...(form.height && { height: form.height.trim() }),
      ...(form.discount_applicable !== undefined && {
        discount_applicable: form.discount_applicable,
      }),
      ...(form.discount_value !== undefined && {
        discount_value: form.discount_value,
      }),
      ...(form.notes && { note: form.notes }),
      ...(form.date_of_birth && { date_of_birth: form.date_of_birth }),
      ...(form.gender && form.gender !== "" && { gender: form.gender }),
      // Pass customer_created_by principal
      ...(form.customer_created_by !== undefined && {
        customer_created_by: form.customer_created_by,
      }),
      // Referral fields
      ...(form.referred_by && { referred_by: form.referred_by }),
      ...(form.referral_commission_amount !== undefined && {
        referral_commission_amount: form.referral_commission_amount,
      }),
      // Customer type
      customer_type: form.customer_type ?? Variant_active_lead_inactive.lead,
      // Lead follow-up fields (only for Lead type)
      ...(form.customer_type === Variant_active_lead_inactive.lead &&
        form.lead_follow_up_date !== undefined && {
          lead_follow_up_date: form.lead_follow_up_date,
        }),
      ...(form.customer_type === Variant_active_lead_inactive.lead &&
        form.lead_notes && { lead_notes: form.lead_notes }),
      // Goals and medical issues
      ...(selectedGoalIds.length > 0 && { primary_goal_ids: selectedGoalIds }),
      ...(selectedIssueIds.length > 0 && {
        medical_issue_ids: selectedIssueIds,
      }),
    } as typeof customerInput & {
      primary_goal_ids?: bigint[];
      medical_issue_ids?: bigint[];
    };

    try {
      if (editing) {
        await updateCustomer.mutateAsync({
          id: editing.id,
          input: customerInput,
        });
        toast.success("Customer updated successfully");
        onClose();
      } else {
        const customerId = await createCustomer.mutateAsync(customerInput);
        // Save initial body composition entry if filled
        if (hasBodyComp && bodyCompForm.date) {
          try {
            await createBodyComp.mutateAsync({
              customerId,
              input: bodyCompForm,
            });
          } catch {
            // Non-blocking — customer is already created
            toast.warning(
              "Customer created, but body composition entry failed to save",
            );
          }
        }
        toast.success("Customer added successfully");
        onClose();
      }
    } catch {
      toast.error(
        editing ? "Failed to update customer" : "Failed to create customer",
      );
    }
  }

  const loading =
    createCustomer.isPending ||
    updateCustomer.isPending ||
    createBodyComp.isPending;
  const showForm = dupState.step !== "found";
  const showDiscountValue = !!form.discount_applicable;

  // City options based on selected state
  const cityOptions = form.state ? (CITIES_BY_STATE[form.state] ?? []) : [];

  // Current user's principal as string for the select value
  const currentPrincipalStr = form.customer_created_by?.toString() ?? "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        data-ocid="customer.dialog"
      >
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
              {/* Customer Type selector */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="cust-type"
                  className="text-sm flex items-center gap-1.5"
                >
                  Customer Type
                </Label>
                <div className="flex items-center gap-3">
                  <Select
                    value={
                      form.customer_type === Variant_active_lead_inactive.active
                        ? "active"
                        : form.customer_type ===
                            Variant_active_lead_inactive.inactive
                          ? "inactive"
                          : "lead"
                    }
                    onValueChange={(v) => {
                      const ct =
                        v === "active"
                          ? Variant_active_lead_inactive.active
                          : v === "inactive"
                            ? Variant_active_lead_inactive.inactive
                            : Variant_active_lead_inactive.lead;
                      setField("customer_type", ct);
                    }}
                  >
                    <SelectTrigger
                      id="cust-type"
                      className="h-9 text-sm"
                      data-ocid="customer.type.select"
                    >
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <CustomerTypeBadge
                    ct={form.customer_type ?? Variant_active_lead_inactive.lead}
                  />
                </div>
              </div>

              {/* Lead Follow-up fields — shown only for Lead type */}
              {form.customer_type === Variant_active_lead_inactive.lead && (
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Lead Follow-up
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-followup-date" className="text-xs">
                      Follow-up Date
                    </Label>
                    <Input
                      id="cust-followup-date"
                      type="date"
                      className="h-9 text-sm"
                      data-ocid="customer.followup_date.input"
                      value={
                        form.lead_follow_up_date
                          ? new Date(
                              Number(form.lead_follow_up_date) / 1_000_000,
                            )
                              .toISOString()
                              .split("T")[0]
                          : ""
                      }
                      onChange={(e) => {
                        if (e.target.value) {
                          const ts = BigInt(
                            new Date(e.target.value).getTime() * 1_000_000,
                          );
                          setField("lead_follow_up_date", ts);
                        } else {
                          setField("lead_follow_up_date", undefined);
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-followup-notes" className="text-xs">
                      Follow-up Notes
                    </Label>
                    <Textarea
                      id="cust-followup-notes"
                      className="text-xs min-h-[56px] resize-none"
                      placeholder="Notes for follow-up…"
                      value={form.lead_notes ?? ""}
                      onChange={(e) =>
                        setField("lead_notes", e.target.value || undefined)
                      }
                      data-ocid="customer.followup_notes.textarea"
                    />
                  </div>
                </div>
              )}
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

              {/* Date of Birth + Gender + Height row */}
              <div className="grid grid-cols-3 gap-3">
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
                <div className="space-y-1.5">
                  <Label htmlFor="cust-height" className="text-xs">
                    Height
                  </Label>
                  <Input
                    id="cust-height"
                    className="h-9 text-sm"
                    data-ocid="customer.height.input"
                    value={form.height ?? ""}
                    onChange={(e) => setField("height", e.target.value || "")}
                    placeholder="5'10&quot; or 178cm"
                  />
                </div>
              </div>

              {/* Created By dropdown */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="cust-created-by"
                  className="text-sm flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                  Created By
                </Label>
                <Select
                  value={currentPrincipalStr || "none"}
                  onValueChange={(v) => {
                    if (v === "none") {
                      setField("customer_created_by", undefined);
                    } else {
                      // Find matching user and set their Principal object
                      const matched = profileUsers.find(
                        (u) => u.principal.toString() === v,
                      );
                      if (matched) {
                        setField("customer_created_by", matched.principal);
                      }
                    }
                  }}
                >
                  <SelectTrigger
                    id="cust-created-by"
                    className="h-9 text-sm"
                    data-ocid="customer.created_by.select"
                  >
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Not specified —</SelectItem>
                    {profileUsers.map((u) => (
                      <SelectItem
                        key={u.principal.toString()}
                        value={u.principal.toString()}
                      >
                        {u.display_name}
                        {u.principal.toString() ===
                          userProfile?.principal?.toString() && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Referral Section */}
              <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5" /> Referral
                </p>
                {/* Referred By */}
                <div className="space-y-1.5">
                  <Label htmlFor="cust-referred-by" className="text-xs">
                    Referred By
                  </Label>
                  <Select
                    value={form.referred_by ?? "none"}
                    onValueChange={(v) =>
                      setField("referred_by", v === "none" ? undefined : v)
                    }
                  >
                    <SelectTrigger
                      id="cust-referred-by"
                      className="h-9 text-sm"
                      data-ocid="customer.referred_by.select"
                    >
                      <SelectValue placeholder="Select referral user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {referralUsers.map((u) => (
                        <SelectItem
                          key={u.principal.toString()}
                          value={u.display_name}
                        >
                          {u.display_name}
                          {u.principal.toString() ===
                            userProfile?.principal?.toString() && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              (you)
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Referral Commission Amount — shown only when a referral user is selected */}
                {form.referred_by && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-commission" className="text-xs">
                      Referral Commission Amount (₹)
                    </Label>
                    <Input
                      id="cust-commission"
                      type="number"
                      min={0}
                      step={0.01}
                      className="h-9 text-sm"
                      value={form.referral_commission_amount ?? ""}
                      onChange={(e) => {
                        const v = Number.parseFloat(e.target.value);
                        setField(
                          "referral_commission_amount",
                          Number.isNaN(v) ? undefined : v,
                        );
                      }}
                      placeholder="0.00"
                      data-ocid="customer.referral_commission.input"
                    />
                  </div>
                )}
              </div>

              {/* Address Section */}
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Address
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="cust-addr1" className="text-xs">
                    Address Line 1
                  </Label>
                  <Input
                    id="cust-addr1"
                    data-ocid="customer.address_line1.input"
                    className="h-9 text-sm"
                    value={form.address_line1 ?? ""}
                    onChange={(e) => setField("address_line1", e.target.value)}
                    placeholder="Flat / House / Building No., Street"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cust-addr2" className="text-xs">
                    Address Line 2
                  </Label>
                  <Input
                    id="cust-addr2"
                    data-ocid="customer.address_line2.input"
                    className="h-9 text-sm"
                    value={form.address_line2 ?? ""}
                    onChange={(e) => setField("address_line2", e.target.value)}
                    placeholder="Area / Locality / Landmark"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <LocationSelect
                    label="Country"
                    value={form.country ?? "India"}
                    options={COUNTRIES}
                    onChange={(v) => setField("country", v || "India")}
                    data-ocid="customer.country.select"
                  />
                  <LocationSelect
                    label="State"
                    value={form.state ?? ""}
                    options={INDIAN_STATES}
                    placeholder="Select state"
                    onChange={(v) => {
                      setForm((prev) => ({ ...prev, state: v, city: "" }));
                    }}
                    data-ocid="customer.state.select"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <LocationSelect
                    label="City"
                    value={form.city ?? ""}
                    options={cityOptions}
                    placeholder="Select city"
                    onChange={(v) => setField("city", v)}
                    data-ocid="customer.city.select"
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-pin" className="text-xs">
                      Pin Code
                    </Label>
                    <Input
                      id="cust-pin"
                      data-ocid="customer.pin_code.input"
                      className="h-9 text-sm"
                      value={form.pin_code ?? ""}
                      onChange={(e) => setField("pin_code", e.target.value)}
                      placeholder="400001"
                      maxLength={10}
                    />
                  </div>
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

              {/* Primary Goals multi-select */}
              <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" /> Primary Goals
                  {selectedGoalIds.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-auto">
                      {selectedGoalIds.length} selected
                    </Badge>
                  )}
                </p>
                <Input
                  placeholder="Search goals…"
                  value={goalSearch}
                  onChange={(e) => setGoalSearch(e.target.value)}
                  className="h-8 text-xs"
                  data-ocid="customer.goals_search.input"
                />
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {allGoals
                    .filter((g) =>
                      g.name.toLowerCase().includes(goalSearch.toLowerCase()),
                    )
                    .map((g) => {
                      const sel = selectedGoalIds.some((id) => id === g.id);
                      return (
                        <button
                          key={g.id.toString()}
                          type="button"
                          className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors text-left hover:bg-muted/40 ${sel ? "bg-primary/5" : ""}`}
                          onClick={() => {
                            setSelectedGoalIds((prev) =>
                              sel
                                ? prev.filter((id) => id !== g.id)
                                : [...prev, g.id],
                            );
                          }}
                          data-ocid={`customer.goal.${g.id.toString()}.toggle`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${sel ? "bg-primary border-primary" : "border-border"}`}
                          >
                            {sel && (
                              <span className="text-primary-foreground text-[8px] leading-none">
                                ✓
                              </span>
                            )}
                          </div>
                          <Target className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{g.name}</span>
                        </button>
                      );
                    })}
                  {allGoals.filter((g) =>
                    g.name.toLowerCase().includes(goalSearch.toLowerCase()),
                  ).length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-1">
                      No goals found
                    </p>
                  )}
                </div>
                {/* Inline add new goal */}
                {addingGoal ? (
                  <div className="flex gap-1.5">
                    <Input
                      className="h-7 text-xs flex-1"
                      placeholder="New goal name"
                      value={newGoalName}
                      onChange={(e) => setNewGoalName(e.target.value)}
                      autoFocus
                      onKeyDown={async (e) => {
                        if (
                          e.key === "Enter" &&
                          newGoalName.trim() &&
                          profileKey
                        ) {
                          e.preventDefault();
                          try {
                            const newId = await createGoal.mutateAsync({
                              profileKey,
                              input: {
                                name: newGoalName.trim(),
                                description: "",
                                product_bundle: [],
                              },
                            });
                            setSelectedGoalIds((prev) => [...prev, newId]);
                            setNewGoalName("");
                            setAddingGoal(false);
                          } catch {
                            toast.error("Failed to create goal");
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={async () => {
                        if (!newGoalName.trim() || !profileKey) return;
                        try {
                          const newId = await createGoal.mutateAsync({
                            profileKey,
                            input: {
                              name: newGoalName.trim(),
                              description: "",
                              product_bundle: [],
                            },
                          });
                          setSelectedGoalIds((prev) => [...prev, newId]);
                          setNewGoalName("");
                          setAddingGoal(false);
                        } catch {
                          toast.error("Failed to create goal");
                        }
                      }}
                    >
                      Add
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setAddingGoal(false);
                        setNewGoalName("");
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    onClick={() => setAddingGoal(true)}
                  >
                    <Plus className="w-3 h-3" /> Define new goal
                  </button>
                )}
              </div>

              {/* Medical Issues multi-select */}
              <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5" /> Medical Issues
                  {selectedIssueIds.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-auto">
                      {selectedIssueIds.length} selected
                    </Badge>
                  )}
                </p>
                <Input
                  placeholder="Search medical issues…"
                  value={issueSearch}
                  onChange={(e) => setIssueSearch(e.target.value)}
                  className="h-8 text-xs"
                  data-ocid="customer.issues_search.input"
                />
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {allIssues
                    .filter((i) =>
                      i.name.toLowerCase().includes(issueSearch.toLowerCase()),
                    )
                    .map((issue) => {
                      const sel = selectedIssueIds.some(
                        (id) => id === issue.id,
                      );
                      return (
                        <button
                          key={issue.id.toString()}
                          type="button"
                          className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors text-left hover:bg-muted/40 ${sel ? "bg-destructive/5" : ""}`}
                          onClick={() => {
                            setSelectedIssueIds((prev) =>
                              sel
                                ? prev.filter((id) => id !== issue.id)
                                : [...prev, issue.id],
                            );
                          }}
                          data-ocid={`customer.issue.${issue.id.toString()}.toggle`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${sel ? "bg-destructive border-destructive" : "border-border"}`}
                          >
                            {sel && (
                              <span className="text-white text-[8px] leading-none">
                                ✓
                              </span>
                            )}
                          </div>
                          <Stethoscope className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{issue.name}</span>
                        </button>
                      );
                    })}
                  {allIssues.filter((i) =>
                    i.name.toLowerCase().includes(issueSearch.toLowerCase()),
                  ).length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-1">
                      No medical issues found
                    </p>
                  )}
                </div>
                {/* Inline add new issue */}
                {addingIssue ? (
                  <div className="flex gap-1.5">
                    <Input
                      className="h-7 text-xs flex-1"
                      placeholder="New medical issue name"
                      value={newIssueName}
                      onChange={(e) => setNewIssueName(e.target.value)}
                      autoFocus
                      onKeyDown={async (e) => {
                        if (
                          e.key === "Enter" &&
                          newIssueName.trim() &&
                          profileKey
                        ) {
                          e.preventDefault();
                          try {
                            const newId = await createIssue.mutateAsync({
                              profileKey,
                              input: {
                                name: newIssueName.trim(),
                                description: "",
                              },
                            });
                            setSelectedIssueIds((prev) => [...prev, newId]);
                            setNewIssueName("");
                            setAddingIssue(false);
                          } catch {
                            toast.error("Failed to create medical issue");
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={async () => {
                        if (!newIssueName.trim() || !profileKey) return;
                        try {
                          const newId = await createIssue.mutateAsync({
                            profileKey,
                            input: {
                              name: newIssueName.trim(),
                              description: "",
                            },
                          });
                          setSelectedIssueIds((prev) => [...prev, newId]);
                          setNewIssueName("");
                          setAddingIssue(false);
                        } catch {
                          toast.error("Failed to create medical issue");
                        }
                      }}
                    >
                      Add
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setAddingIssue(false);
                        setNewIssueName("");
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    onClick={() => setAddingIssue(true)}
                  >
                    <Plus className="w-3 h-3" /> Define new medical issue
                  </button>
                )}
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

              {/* Body Composition Section (Create only) */}
              {!editing && (
                <div className="rounded-lg border border-border bg-muted/10">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/20 transition-colors rounded-lg"
                    onClick={() => {
                      setBodyCompOpen((p) => !p);
                      setHasBodyComp(true);
                    }}
                    data-ocid="customer.body_comp_toggle"
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Activity className="w-3.5 h-3.5" />
                      Body Composition (optional)
                    </span>
                    {bodyCompOpen ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  {bodyCompOpen && (
                    <div
                      className="px-3 pb-3 pt-1"
                      data-ocid="customer.body_comp_section"
                    >
                      <BodyCompFields
                        form={bodyCompForm}
                        onChange={(updated) => {
                          setBodyCompForm(updated);
                          setHasBodyComp(true);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

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
  profileUsers?: import("../backend").UserProfilePublic[];
  profileKey?: string | null;
}

function CustomerDetailSheet({
  customer,
  onClose,
  onEdit,
  canEdit,
  profileUsers = [],
  profileKey,
}: CustomerDetailSheetProps) {
  const [activeTab, setActiveTab] = useState("info");

  // Fetch goals and issues for the info tab display
  const { data: allGoals = [] } = useGetGoalMasterData(profileKey ?? null);
  const { data: allIssues = [] } = useGetMedicalIssueMasterData(
    profileKey ?? null,
  );

  // Look up display name for customer_created_by principal
  function getCreatorName(principalStr: string | undefined): string | null {
    if (!principalStr) return null;
    const match = profileUsers.find(
      (u) => u.principal.toString() === principalStr,
    );
    return match ? match.display_name : `${principalStr.slice(0, 12)}…`;
  }

  const creatorName = customer?.customer_created_by
    ? getCreatorName(customer.customer_created_by.toString())
    : null;

  return (
    <Sheet open={!!customer} onOpenChange={(o) => !o && onClose()}>
      {/* Fixed at 50% viewport width; close button in header row, not floating */}
      <SheetContent
        className="w-full sm:w-1/2 sm:max-w-none overflow-y-auto"
        data-ocid="customer.detail.sheet"
      >
        {customer && (
          <>
            {/* Sheet header: avatar + name + edit btn + close (from SheetContent's built-in X) */}
            <SheetHeader className="pb-4 border-b border-border pr-8">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="text-left truncate">
                      {customer.name}
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <CustomerTypeBadge ct={customer.customer_type} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Customer since {formatDate(customer.created_at)}
                    </p>
                    {creatorName && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        Created by: {creatorName}
                      </p>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(customer)}
                    className="shrink-0 z-10 relative"
                    data-ocid="customer.detail.edit_button"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Edit
                  </Button>
                )}
              </div>
            </SheetHeader>

            {/* Main content with left padding */}
            <div className="pl-6 sm:pl-8">
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
                <TabsList className="w-full grid grid-cols-5">
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
                  <TabsTrigger
                    value="inches"
                    className="text-xs"
                    data-ocid="customer.detail.inches_tab"
                  >
                    <Ruler className="w-3.5 h-3.5 mr-1" /> Inches
                  </TabsTrigger>
                </TabsList>

                {/* Info tab — consolidated */}
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

                  {/* Address — show structured or fallback */}
                  <div className="flex items-start gap-2.5 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      {customer.address_line1 ||
                      customer.address_line2 ||
                      customer.city ||
                      customer.state ? (
                        <>
                          {customer.address_line1 && (
                            <p>{customer.address_line1}</p>
                          )}
                          {customer.address_line2 && (
                            <p className="text-muted-foreground">
                              {customer.address_line2}
                            </p>
                          )}
                          {(customer.city ||
                            customer.state ||
                            customer.pin_code) && (
                            <p className="text-muted-foreground">
                              {[
                                customer.city,
                                customer.state,
                                customer.pin_code,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          )}
                          {customer.country && (
                            <p className="text-muted-foreground text-xs">
                              {customer.country}
                            </p>
                          )}
                        </>
                      ) : (
                        <span>{customer.address || "—"}</span>
                      )}
                    </div>
                  </div>

                  {/* Personal info */}
                  {(customer.date_of_birth ||
                    customer.gender ||
                    customer.height) && (
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
                          {(() => {
                            const age = calcAge(customer.date_of_birth);
                            return age !== null ? (
                              <Badge
                                variant="secondary"
                                className="text-xs ml-1"
                              >
                                Age: {age} yrs
                              </Badge>
                            ) : null;
                          })()}
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
                      {customer.height && (
                        <div className="flex items-center gap-2.5 text-sm">
                          <Ruler className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground text-xs w-12 shrink-0">
                            Height
                          </span>
                          <span>{customer.height}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lead to Active date */}
                  {(() => {
                    const rawC = customer as typeof customer & {
                      lead_to_active_datetime?: bigint;
                    };
                    return rawC.lead_to_active_datetime &&
                      Number(rawC.lead_to_active_datetime) > 0 ? (
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center gap-2.5 text-sm">
                          <CalendarPlus className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground text-xs w-20 shrink-0">
                            Became Active
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-xs bg-primary/10 text-primary border-primary/20"
                          >
                            {
                              new Date(
                                Number(rawC.lead_to_active_datetime) /
                                  1_000_000,
                              )
                                .toISOString()
                                .split("T")[0]
                            }
                          </Badge>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Primary Goals */}
                  {(() => {
                    const rawC = customer as typeof customer & {
                      primary_goal_ids?: bigint[];
                    };
                    const goalIds = rawC.primary_goal_ids ?? [];
                    if (goalIds.length === 0) return null;
                    const goalNames = goalIds
                      .map(
                        (id) =>
                          allGoals.find((g) => g.id === id)?.name ?? `#${id}`,
                      )
                      .filter(Boolean);
                    return (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5" /> Primary Goals
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {goalNames.map((name) => (
                            <Badge
                              key={name}
                              className="text-xs bg-primary/10 text-primary border-primary/20"
                            >
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Medical Issues */}
                  {(() => {
                    const rawC = customer as typeof customer & {
                      medical_issue_ids?: bigint[];
                    };
                    const issueIds = rawC.medical_issue_ids ?? [];
                    if (issueIds.length === 0) return null;
                    const issueNames = issueIds
                      .map(
                        (id) =>
                          allIssues.find((i) => i.id === id)?.name ?? `#${id}`,
                      )
                      .filter(Boolean);
                    return (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5" /> Medical Issues
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {issueNames.map((name) => (
                            <Badge
                              key={name}
                              variant="outline"
                              className="text-xs text-destructive border-destructive/30"
                            >
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

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

                  {/* Referral info */}
                  {customer.referred_by && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Referral
                      </p>
                      <div className="flex items-center gap-2.5 text-sm">
                        <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground text-xs w-20 shrink-0">
                          Referred By
                        </span>
                        <span className="font-medium">
                          {customer.referred_by}
                        </span>
                      </div>
                      {customer.referral_commission_amount !== undefined &&
                        customer.referral_commission_amount > 0 && (
                          <div className="flex items-center gap-2.5 text-sm mt-1.5">
                            <span className="w-4 h-4 shrink-0" />
                            <span className="text-muted-foreground text-xs w-20 shrink-0">
                              Commission
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              ₹
                              {customer.referral_commission_amount.toLocaleString(
                                "en-IN",
                              )}
                            </Badge>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Lead follow-up info */}
                  {customer.customer_type ===
                    Variant_active_lead_inactive.lead &&
                    (customer.lead_follow_up_date || customer.lead_notes) && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-2 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Lead Follow-up
                        </p>
                        {customer.lead_follow_up_date &&
                          customer.lead_follow_up_date > BigInt(0) && (
                            <div className="flex items-center gap-2.5 text-sm mb-1.5">
                              <span className="text-muted-foreground text-xs w-20 shrink-0">
                                Follow-up Date
                              </span>
                              <Badge className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/20">
                                {
                                  new Date(
                                    Number(customer.lead_follow_up_date) /
                                      1_000_000,
                                  )
                                    .toISOString()
                                    .split("T")[0]
                                }
                              </Badge>
                              {Number(customer.lead_follow_up_date) /
                                1_000_000 <
                                Date.now() && (
                                <Badge className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                                  Overdue
                                </Badge>
                              )}
                            </div>
                          )}
                        {customer.lead_notes && (
                          <p className="text-xs text-muted-foreground italic">
                            {customer.lead_notes}
                          </p>
                        )}
                      </div>
                    )}
                </TabsContent>

                {/* History tab */}
                <TabsContent value="history" className="pt-4">
                  <CustomerOrderHistory customer={customer} />
                </TabsContent>

                {/* Notes tab — multi-note manager */}
                <TabsContent value="notes" className="pt-4">
                  <NotesManager
                    customer={customer}
                    canEdit={canEdit}
                    profileKey={profileKey ?? ""}
                  />
                </TabsContent>

                {/* Body Composition tab — ALL entries sorted latest first */}
                <TabsContent value="body" className="pt-4">
                  <BodyCompositionTab customer={customer} />
                </TabsContent>

                {/* Body Inches tab */}
                <TabsContent value="inches" className="pt-4">
                  <BodyInchesTab
                    customer={customer}
                    profileKey={profileKey ?? ""}
                  />
                </TabsContent>
              </Tabs>
            </div>
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
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <CustomerTypeBadge ct={customer.customer_type} />
                        {customer.email && (
                          <p className="text-xs text-muted-foreground truncate hidden sm:block">
                            {customer.email}
                          </p>
                        )}
                      </div>
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

  // Fetch profile users once at page level — passed into detail sheet for "Created By" lookup
  const profileKey = userProfile?.profile_key ?? null;
  const { data: profileUsers = [] } = useGetUsersByProfile(profileKey);

  const customers: CustomerPublicWithDiscount[] = rawCustomers.map((c) => {
    const stored = getStoredCustomerDiscount(c.id.toString());
    const notesText = c.notes.length > 0 ? c.notes[0].text : stored.notes;
    // Cast to access new referral fields that may not yet be in d.ts
    const raw = c as typeof c & {
      referred_by?: string;
      referral_commission_amount?: number;
    };
    return {
      ...c,
      notesText,
      referred_by: raw.referred_by,
      referral_commission_amount: raw.referral_commission_amount,
    };
  });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CustomerTypeFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Auto-open create dialog when ?create=true is in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "true") {
      setDialogOpen(true);
    }
  }, []);
  const [editing, setEditing] = useState<CustomerPublicWithDiscount | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] =
    useState<CustomerPublicWithDiscount | null>(null);
  const [detailCustomer, setDetailCustomer] =
    useState<CustomerPublicWithDiscount | null>(null);

  const role = userProfile?.role as string | undefined;
  const canEdit =
    role === ROLES.ADMIN ||
    role === ROLES.SUPER_ADMIN ||
    role === ROLES.STAFF ||
    role === ROLES.REFERRAL_USER;
  const canDelete =
    role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN || role === ROLES.STAFF;

  const now = Date.now();
  const filtered = customers.filter((c) => {
    // Text search
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.phone.includes(q))
        return false;
    }
    // Type filter
    if (typeFilter === "lead") {
      return c.customer_type === Variant_active_lead_inactive.lead;
    }
    if (typeFilter === "active") {
      return c.customer_type === Variant_active_lead_inactive.active;
    }
    if (typeFilter === "inactive") {
      return c.customer_type === Variant_active_lead_inactive.inactive;
    }
    if (typeFilter === "followup") {
      return (
        c.customer_type === Variant_active_lead_inactive.lead &&
        c.lead_follow_up_date !== undefined &&
        c.lead_follow_up_date > BigInt(0) &&
        Number(c.lead_follow_up_date) / 1_000_000 <= now
      );
    }
    return true;
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

      {/* Status filter tabs */}
      <div
        className="flex items-center gap-1.5 flex-wrap"
        data-ocid="customers.filter.tabs"
      >
        {(
          [
            { key: "all", label: "All Customers" },
            { key: "lead", label: "Leads" },
            { key: "active", label: "Active" },
            { key: "inactive", label: "Inactive" },
            { key: "followup", label: "Follow-up Due" },
          ] as { key: CustomerTypeFilter; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              typeFilter === key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            }`}
            onClick={() => setTypeFilter(key)}
            data-ocid={`customers.filter.${key}.tab`}
          >
            {label}
            {key !== "all" && (
              <span className="ml-1.5 opacity-70">
                (
                {
                  customers.filter((c) => {
                    if (key === "lead") {
                      return (
                        c.customer_type === Variant_active_lead_inactive.lead
                      );
                    }
                    if (key === "active") {
                      return (
                        c.customer_type === Variant_active_lead_inactive.active
                      );
                    }
                    if (key === "inactive") {
                      return (
                        c.customer_type ===
                        Variant_active_lead_inactive.inactive
                      );
                    }
                    if (key === "followup") {
                      return (
                        c.customer_type === Variant_active_lead_inactive.lead &&
                        c.lead_follow_up_date !== undefined &&
                        c.lead_follow_up_date > BigInt(0) &&
                        Number(c.lead_follow_up_date) / 1_000_000 <= now
                      );
                    }
                    return false;
                  }).length
                }
                )
              </span>
            )}
          </button>
        ))}
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
        profileUsers={profileUsers}
        profileKey={profileKey}
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
