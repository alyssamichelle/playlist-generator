"use client";

import { Button } from "@progress/kendo-react-buttons";
import { Input } from "@progress/kendo-react-inputs";
import { useCallback, useEffect, useState } from "react";

// Example prompts shown in the input placeholder; one is picked at random on mount
const PROMPT_OPTIONS = [
  "Chill indie songs for a rainy Sunday morning",
  "High-energy gym playlist with no sad songs",
  "Country road trip vibes, upbeat and nostalgic",
  "Lo-fi focus music with no vocals, 1 hour long",
  "Songs like Zach Bryan but a little more upbeat",
  "Feel-good pop hits from the 2010s",
  "Late night drive, moody and atmospheric",
  "Clean country playlist for a family cookout",
  "Emotional but empowering breakup playlist",
  "Coffee shop acoustic vibes, soft and cozy",
];

export interface SearchFormProps {
  /** Called when user submits. Receives the prompt. */
  onSubmit: (prompt: string) => void;
  /** Whether a request is in progress. */
  disabled?: boolean;
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
  submitLabel = "Generate",
}: SearchFormProps) {
  // Controlled input value; empty string until user types
  const [value, setValue] = useState("");
  const [placeholder, setPlaceholder] = useState('');
  const [randomPlaceholder, setRandomPlaceholder] = useState(() => getRandomPlaceholder());

  useEffect(() => {
    if (value.trim()) return;
    const id = setInterval(() => {
      setRandomPlaceholder(getRandomPlaceholder());
    }, 6000);
    return () => clearInterval(id);
  }, [value]);

  useEffect(() => {
    setPlaceholder(randomPlaceholder);
  }, [randomPlaceholder]);

  function getRandomPlaceholder() {
    return PROMPT_OPTIONS[Math.floor(Math.random() * PROMPT_OPTIONS.length)];
  }

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      // Prevent default form submission (page reload)
      e.preventDefault();
      // Only submit if there's non-whitespace content and we're not disabled
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
      {/* Screen reader hint; keep generic since placeholder text rotates */}
      <span id="search-hint" className="visually-hidden">
        Prompt with a genre, artist, or vibe: "Lo-fi for studing", "Best of Queen", "Road trip mix"
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