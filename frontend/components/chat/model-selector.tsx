"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelType } from "@/lib/ai-config";

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
    <Select
      value={model}
      onValueChange={(value) => onChange(value as ModelType)}
      disabled={disabled}
    >
      <SelectTrigger className="h-5 w-[120px] text-[10px]">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="gpt-4o">gpt-4o</SelectItem>
        <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
        <SelectItem value="agent-1">Agent-1</SelectItem>
        <SelectItem value="mixtral-8x7b-32768">mixtral-32k</SelectItem>
        <SelectItem value="llama-3.3-70b-versatile">llama-70b</SelectItem>
        <SelectItem value="deepseek-r1-distill-llama-70b">
          deepseek-70b
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
