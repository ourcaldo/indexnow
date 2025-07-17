import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    label: string;
    type: "positive" | "negative" | "neutral";
  };
  className?: string;
}

export default function StatsCard({
  title,
  value,
  description,
  icon,
  trend,
  className
}: StatsCardProps) {
  return (
    <Card className={cn("card-hover", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="text-2xl font-bold text-slate-800 mt-2">{value}</p>
            {trend && (
              <p className={cn(
                "text-xs mt-1",
                trend.type === "positive" && "text-emerald-600",
                trend.type === "negative" && "text-red-600",
                trend.type === "neutral" && "text-slate-500"
              )}>
                {trend.value} {trend.label}
              </p>
            )}
            {description && (
              <p className="text-xs text-slate-500 mt-1">{description}</p>
            )}
          </div>
          <div className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center",
            trend?.type === "positive" && "bg-emerald-100",
            trend?.type === "negative" && "bg-red-100",
            (!trend || trend.type === "neutral") && "bg-blue-100"
          )}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
