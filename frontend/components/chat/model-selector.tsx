"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ModelType =
  | "gpt-4o-mini"
  | "gpt-4o"
  | "deepseek-reasoner"
  | "agent-gpt4o";

interface ModelSelectorProps {
  model: ModelType;
  onChange: (model: ModelType) => void;
  disabled?: boolean;
}

export function ModelSelector({
  model,
  onChange,
  disabled = false,
}: ModelSelectorProps) {
  return (
    <Select value={model} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={`h-5 w-[120px] border-none bg-transparent pl-0 text-[10px] text-muted-foreground focus:ring-0 ${
          disabled
            ? "cursor-default hover:bg-transparent [&>svg]:hidden"
            : "hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="gpt-4o">gpt-4o</SelectItem>
        <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
        <SelectItem value="deepseek-reasoner">deepseek-reasoner</SelectItem>
        <SelectItem value="agent-gpt4o">Agent</SelectItem>
      </SelectContent>
    </Select>
  );
}
