"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const tools = [
  {
    value: "components",
    label: "Components",
  },
  {
    value: "sveltekit",
    label: "SvelteKit",
  },
]

type ToolComboBoxProps = {
  onToolSelect: (tool: string) => void
}

export function ComboboxDemo({ onToolSelect }: ToolComboBoxProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          {value
            ? tools.find((tool) => tool.value === value)?.label
            : "Tools"}

          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search tools..." />

          <CommandList>
            <CommandEmpty>No tool found.</CommandEmpty>

            <CommandGroup>
              {tools.map((tool) => (
                <CommandItem
                  key={tool.value}
                  value={tool.value}
                  onSelect={(currentValue) => {
                    const newValue =
                      currentValue === value ? "" : currentValue

                    setValue(newValue)
                    onToolSelect(newValue)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === tool.value
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />

                  {tool.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}