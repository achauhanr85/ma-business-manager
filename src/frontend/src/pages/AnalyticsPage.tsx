import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";

interface AnalyticsPageProps {
  onNavigate: (path: string, saleId?: bigint) => void;
}

export function AnalyticsPage({ onNavigate }: AnalyticsPageProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 space-y-5 text-center"
      data-ocid="analytics.page"
    >
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <BarChart3 className="w-8 h-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Advanced Analytics Coming Soon
        </h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Detailed reports, trend charts, and profit breakdowns will be
          available in a future update.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => onNavigate("/")}
        data-ocid="analytics.back_button"
      >
        Back to Dashboard
      </Button>
    </div>
  );
}
