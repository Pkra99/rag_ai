'use client'
import { useEffect, useState } from "react";
import { IconSun, IconMoon } from "@tabler/icons-react";

export default function ThemeSwitch() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  return (
    <button
      aria-label="Toggle dark mode"
      onClick={() => setDark((d) => !d)}
      className="flex items-center justify-center bg-transparent p-0 m-0"
      tabIndex={0}
    >
      {dark ? (
        <IconSun className="w-5 h-5 text-neutral-500 dark:text-neutral-300" />
      ) : (
        <IconMoon className="w-5 h-5 text-neutral-500 dark:text-neutral-300" />
      )}
    </button>
  );
}