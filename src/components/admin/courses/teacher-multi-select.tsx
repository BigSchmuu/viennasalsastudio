"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type TeacherOption = { id: string; label: string };

export function TeacherMultiSelect({
  teachers,
  selected,
  onChange,
}: {
  teachers: TeacherOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id]);
  }

  const selectedLabels = teachers.filter((t) => selected.includes(t.id));

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
            {selected.length > 0 ? `${selected.length} Lehrer ausgewählt` : "Lehrer auswählen"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Lehrer suchen…" />
            <CommandList>
              <CommandEmpty>Keine Lehrer gefunden.</CommandEmpty>
              <CommandGroup>
                {teachers.map((teacher) => (
                  <CommandItem key={teacher.id} onSelect={() => toggle(teacher.id)}>
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected.includes(teacher.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {teacher.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedLabels.map((t) => (
            <Badge key={t.id} variant="secondary">
              {t.label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
