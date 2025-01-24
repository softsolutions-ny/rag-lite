"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ModelType = "gpt-4o-mini" | "deepseek-reasoner" | "gpt-4o";

interface ModelSelectorProps {
  model: ModelType;
  onModelChange: (model: ModelType) => void;
}

export function ModelSelector({ model, onModelChange }: ModelSelectorProps) {
  return (
    <Select value={model} onValueChange={onModelChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
        <SelectItem value="deepseek-reasoner">DeepSeek V1</SelectItem>
        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
      </SelectContent>
    </Select>
  );
}
