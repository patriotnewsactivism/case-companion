import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RequestDeadline } from "@/lib/outbound-requests-api";

interface RequestDeadlineAlertsProps {
  deadlines: RequestDeadline[];
  onSelect?: (id: string) => void;
}

export function RequestDeadlineAlerts({ deadlines, onSelect }: RequestDeadlineAlertsProps) {
  const overdue = deadlines.filter((d) => d.status === "overdue");
  const dueToday = deadlines.filter((d) => d.status === "due_today");
  const thisWeek = deadlines.filter((d) => d.status === "upcoming" && d.daysRemaining <= 7);

  if (overdue.length === 0 && dueToday.length === 0 && thisWeek.length === 0) {
    return null;
  }

  const tiles: {
    key: string;
    icon: typeof AlertTriangle;
    label: string;
    items: RequestDeadline[];
    className: string;
  }[] = [
    { key: "overdue", icon: AlertTriangle, label: "Overdue", items: overdue, className: "border-red-200 bg-red-50 text-red-800" },
    { key: "today", icon: Clock, label: "Due today", items: dueToday, className: "border-amber-200 bg-amber-50 text-amber-800" },
    { key: "week", icon: CalendarClock, label: "Due this week", items: thisWeek, className: "border-blue-200 bg-blue-50 text-blue-800" },
  ].filter((t) => t.items.length > 0);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <Card key={tile.key} className={cn("border", tile.className)}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 font-medium">
                <Icon className="h-4 w-4" />
                <span>
                  {tile.items.length} {tile.label}
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {tile.items.slice(0, 3).map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => onSelect?.(d.id)}
                      className="text-left hover:underline"
                    >
                      {d.title}
                      {typeof d.daysRemaining === "number" && (
                        <span className="opacity-70">
                          {" "}
                          · {d.daysRemaining < 0 ? `${Math.abs(d.daysRemaining)}d late` : `${d.daysRemaining}d`}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
