"use client";
import { useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";
import { Icon } from "./ui/icons";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Hydration guard: rendering the themed icon before mount would mismatch
  // between server and client markup.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <button className="icon-btn w-8 h-8" aria-hidden="true"></button>;
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="icon-btn flex items-center justify-center"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Icon.Sun className="icon-sm" /> : <Icon.Moon className="icon-sm" />}
    </button>
  );
}
