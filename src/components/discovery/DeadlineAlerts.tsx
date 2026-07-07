import React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Clock,
  Calendar,
  Bell,
  Mail,
  ChevronRight,
} from "lucide-react";
import type { DiscoveryDeadline } from "@/lib/discovery-api";

interface DeadlineAlertsProps {
  deadlines: DiscoveryDeadline[];
  onViewOverdue: () => void;
  onViewDueToday: () => void;
  onViewThisWeek: () => void;
  onSendReminders?: () => void;
}

export function DeadlineAlerts({
  deadlines,
  onViewOverdue,
  onViewDueToday,
  onViewThisWeek,
  onSendReminders,
}: DeadlineAlertsProps) {
  const overdue = deadlines.filter(d => d.status === 'overdue');
  const dueToday = deadlines.filter(d => d.status === 'due_today');
  const upcomingWeek = deadlines.filter(d => d.status === 'upcoming' && d.daysRemaining <= 7);

  const hasAlerts = overdue.length > 0 || dueToday.length > 0 || upcomingWeek.length > 0;

  if (!hasAlerts) {
    return (
      <Card className="border-green-200 bg-green-50/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-green-800">All caught up!</p>
              <p className="text-sm text-green-600">No urgent discovery deadlines</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Deadline Alerts
          </CardTitle>
          {onSendReminders && (
            <Button variant="ghost" size="sm" onClick={onSendReminders} className="gap-1">
              <Mail className="h-3 w-3" />
              Email Reminders
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {overdue.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-red-800">Overdue</p>
                <p className="text-sm text-red-600">
                  {overdue.length} request{overdue.length !== 1 ? 's' : ''} past due date
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewOverdue}
              className="text-red-600 hover:text-red-700 hover:bg-red-100"
            >
              View <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {dueToday.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium text-yellow-800">Due Today</p>
                <p className="text-sm text-yellow-600">
                  {dueToday.length} request{dueToday.length !== 1 ? 's' : ''} due today
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewDueToday}
              className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-100"
            >
              View <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {upcomingWeek.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-blue-800">Due This Week</p>
                <p className="text-sm text-blue-600">
                  {upcomingWeek.length} request{upcomingWeek.length !== 1 ? 's' : ''} due within 7 days
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewThisWeek}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
            >
              View <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
