"use client";

import { EditUsername } from "./edit-username";

interface UsernameSectionProps {
  currentUsername: string | null;
}

export function UsernameSection({ currentUsername }: UsernameSectionProps) {
  const handleUpdate = () => {
    // Reload page to show updated username
    window.location.reload();
  };

  return <EditUsername currentUsername={currentUsername} onUpdate={handleUpdate} />;
}
