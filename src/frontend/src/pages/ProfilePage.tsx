import type { ProfileInput } from "@/backend";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useGetProfile, useUpdateProfile } from "@/hooks/useBackend";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Leaf,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ProfilePageProps {
  onNavigate: (path: string, saleId?: bigint) => void;
}

interface FormErrors {
  business_name?: string;
  phone_number?: string;
  business_address?: string;
  fssai_number?: string;
  email?: string;
}

function validateForm(values: ProfileInput): FormErrors {
  const errors: FormErrors = {};

  if (!values.business_name.trim()) {
    errors.business_name = "Business name is required";
  }

  if (!values.phone_number.trim()) {
    errors.phone_number = "Phone number is required";
  } else if (!/^[+\d\s\-()]{7,15}$/.test(values.phone_number.trim())) {
    errors.phone_number = "Enter a valid phone number";
  }

  if (!values.business_address.trim()) {
    errors.business_address = "Business address is required";
  }

  if (!values.fssai_number.trim()) {
    errors.fssai_number = "FSSAI number is required";
  } else if (!/^\d{14}$/.test(values.fssai_number.trim())) {
    errors.fssai_number = "FSSAI number must be exactly 14 digits";
  }

  if (!values.email.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address";
  }

  return errors;
}

const EMPTY_FORM: ProfileInput = {
  business_name: "",
  phone_number: "",
  business_address: "",
  fssai_number: "",
  email: "",
};

function MapPlaceholder({ address }: { address: string }) {
  return (
    <div
      className="relative w-full h-44 rounded-xl overflow-hidden bg-secondary border border-border"
      data-ocid="profile.map_placeholder"
    >
      {/* Decorative map-like grid */}
      <svg
        className="absolute inset-0 w-full h-full opacity-20"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        role="presentation"
      >
        <defs>
          <pattern
            id="grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        {/* Road lines */}
        <line
          x1="0"
          y1="50%"
          x2="100%"
          y2="50%"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.4"
        />
        <line
          x1="40%"
          y1="0"
          x2="40%"
          y2="100%"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.3"
        />
        <line
          x1="70%"
          y1="0"
          x2="70%"
          y2="100%"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.2"
        />
        <line
          x1="0"
          y1="30%"
          x2="100%"
          y2="30%"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.2"
        />
        <line
          x1="0"
          y1="70%"
          x2="100%"
          y2="70%"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.2"
        />
      </svg>

      {/* Pin marker */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
            <MapPin className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="w-2 h-2 rounded-full bg-primary/60" />
        </div>
      </div>

      {/* Address overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-card/90 backdrop-blur-sm border-t border-border px-3 py-2">
        <p className="text-xs text-muted-foreground font-body line-clamp-2 min-h-[2rem]">
          {address.trim() || "Enter your business address above to see it here"}
        </p>
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      className="flex items-center gap-1.5 mt-1"
      data-ocid="profile.field_error"
    >
      <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
      <p className="text-xs text-destructive">{message}</p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5" data-ocid="profile.loading_state">
      <Skeleton className="h-44 rounded-xl" />
      <div className="space-y-4">
        {(["name", "phone", "email", "address", "fssai"] as const).map(
          (field) => (
            <div key={field} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
          ),
        )}
      </div>
      <Skeleton className="h-10 rounded-lg" />
    </div>
  );
}

export function ProfilePage({ onNavigate: _onNavigate }: ProfilePageProps) {
  const { data: profile, isLoading } = useGetProfile();
  const updateProfile = useUpdateProfile();

  const [form, setForm] = useState<ProfileInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<
    Partial<Record<keyof ProfileInput, boolean>>
  >({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm(profile);
    }
  }, [profile]);

  const handleChange = (field: keyof ProfileInput, value: string) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    setSaved(false);
    if (touched[field]) {
      const fieldErrors = validateForm(updated);
      setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }));
    }
  };

  const handleBlur = (field: keyof ProfileInput) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const fieldErrors = validateForm(form);
    setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allTouched = Object.fromEntries(
      (Object.keys(form) as (keyof ProfileInput)[]).map((k) => [k, true]),
    ) as Partial<Record<keyof ProfileInput, boolean>>;
    setTouched(allTouched);

    const validationErrors = validateForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fix the errors before saving");
      return;
    }

    try {
      await updateProfile.mutateAsync(form);
      setSaved(true);
      toast.success("Profile saved successfully!", {
        description: "Your business information has been updated.",
        icon: <CheckCircle2 className="w-4 h-4 text-primary" />,
      });
    } catch {
      toast.error("Failed to save profile", {
        description: "Please try again.",
      });
    }
  };

  if (isLoading) return <ProfileSkeleton />;

  return (
    <form onSubmit={handleSubmit} noValidate data-ocid="profile.page">
      <div className="space-y-5">
        {/* Map preview */}
        <MapPlaceholder address={form.business_address} />

        {/* Profile card */}
        <Card className="card-elevated">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Leaf className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base font-display">
                  Business Information
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  This information appears on your receipts
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Business Name */}
            <div className="space-y-1.5">
              <Label
                htmlFor="business_name"
                className="flex items-center gap-1.5 text-sm"
              >
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                Business Name
              </Label>
              <Input
                id="business_name"
                placeholder="MA Herb Distributors"
                value={form.business_name}
                onChange={(e) => handleChange("business_name", e.target.value)}
                onBlur={() => handleBlur("business_name")}
                className={
                  errors.business_name
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
                data-ocid="profile.business_name.input"
              />
              <FieldError message={errors.business_name} />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label
                htmlFor="phone_number"
                className="flex items-center gap-1.5 text-sm"
              >
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                Phone Number
              </Label>
              <Input
                id="phone_number"
                type="tel"
                placeholder="+91 98765 43210"
                value={form.phone_number}
                onChange={(e) => handleChange("phone_number", e.target.value)}
                onBlur={() => handleBlur("phone_number")}
                className={
                  errors.phone_number
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
                data-ocid="profile.phone_number.input"
              />
              <FieldError message={errors.phone_number} />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="flex items-center gap-1.5 text-sm"
              >
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@maherb.in"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                className={
                  errors.email
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
                data-ocid="profile.email.input"
              />
              <FieldError message={errors.email} />
            </div>

            {/* Business Address */}
            <div className="space-y-1.5">
              <Label
                htmlFor="business_address"
                className="flex items-center gap-1.5 text-sm"
              >
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                Business Address
              </Label>
              <Input
                id="business_address"
                placeholder="123 Herb Lane, Green City, MH 400001"
                value={form.business_address}
                onChange={(e) =>
                  handleChange("business_address", e.target.value)
                }
                onBlur={() => handleBlur("business_address")}
                className={
                  errors.business_address
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
                data-ocid="profile.business_address.input"
              />
              <FieldError message={errors.business_address} />
            </div>

            {/* FSSAI Number */}
            <div className="space-y-1.5">
              <Label
                htmlFor="fssai_number"
                className="flex items-center gap-1.5 text-sm"
              >
                <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                FSSAI License Number
              </Label>
              <Input
                id="fssai_number"
                placeholder="12345678901234"
                value={form.fssai_number}
                maxLength={14}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 14);
                  handleChange("fssai_number", val);
                }}
                onBlur={() => handleBlur("fssai_number")}
                className={`font-mono tracking-widest ${errors.fssai_number ? "border-destructive focus-visible:ring-destructive" : ""}`}
                data-ocid="profile.fssai_number.input"
              />
              <div className="flex items-center justify-between">
                <FieldError message={errors.fssai_number} />
                <span className="text-xs text-muted-foreground ml-auto">
                  {form.fssai_number.length}/14
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your 14-digit FSSAI license number (printed on receipts)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save button */}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={updateProfile.isPending}
          data-ocid="profile.save_button"
        >
          {updateProfile.isPending ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
              Saving…
            </span>
          ) : saved ? (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Saved
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              Save Profile
            </span>
          )}
        </Button>

        {updateProfile.isError && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20"
            data-ocid="profile.error_state"
          >
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">
              Failed to update profile. Please try again.
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
