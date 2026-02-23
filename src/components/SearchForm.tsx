"use client";

import { Button } from "@progress/kendo-react-buttons";
import { Input } from "@progress/kendo-react-inputs";
import { useCallback, useState } from "react";

export interface SearchFormProps {
  /** Called when user submits. Receives the prompt. */
  onSubmit: (prompt: string) => void;
  /** Whether a request is in progress. */
  disabled?: boolean;
  /** Placeholder for the input. */
  placeholder?: string;
  /** Label for the submit button. */
  submitLabel?: string;
}

/**
 * Reusable search form with input and submit button.
 * Uses semantic markup and accessibility attributes.
 */
export default function SearchForm({
  onSubmit,
  disabled = false,
  placeholder = "Describe the vibe, mood, or songs you want…",
  submitLabel = "Generate",
}: SearchFormProps) {
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit(value.trim());
      }
    },
    [value, disabled, onSubmit]
  );

  return (
    <form
      role="search"
      aria-label="Generate playlist"
      onSubmit={handleSubmit}
      className="search-form"
    >
      <label htmlFor="playlist-prompt" className="visually-hidden">
        Playlist prompt
      </label>
      <Input
        id="playlist-prompt"
        value={value}
        onChange={(e) => setValue(e.value ?? "")}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        aria-describedby="search-hint"
        className="search-input"
      />
      <span id="search-hint" className="visually-hidden">
        Type a mood, genre, or activity and press Generate.
      </span>
      <Button
        type="submit"
        themeColor="primary"
        disabled={disabled || !value.trim()}
        aria-busy={disabled}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
