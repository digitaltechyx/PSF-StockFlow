"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  fromDate?: Date;
  toDate?: Date;
  setFromDate: (date?: Date) => void;
  setToDate: (date?: Date) => void;
  className?: string;
}

export function DateRangePicker({ 
  fromDate, 
  toDate, 
  setFromDate, 
  setToDate, 
  className 
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range) {
      setFromDate(range.from);
      setToDate(range.to);
    }
  };

  const clearDates = () => {
    setFromDate(undefined);
    setToDate(undefined);
  };

  const formatDateRange = () => {
    if (fromDate && toDate) {
      return `${format(fromDate, "MMM dd")} - ${format(toDate, "MMM dd, yyyy")}`;
    } else if (fromDate) {
      return `From ${format(fromDate, "MMM dd, yyyy")}`;
    } else if (toDate) {
      return `Until ${format(toDate, "MMM dd, yyyy")}`;
    }
    return "Select date range";
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !fromDate && !toDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDateRange()}
          {(fromDate || toDate) && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 w-6 p-0 hover:bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                clearDates();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={{ from: fromDate, to: toDate }}
          onSelect={handleDateSelect}
          numberOfMonths={2}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
