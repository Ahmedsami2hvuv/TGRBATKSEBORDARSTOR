"use client";

import { ClickableNotesCard } from "./clickable-notes-card";

export function NotesCopyButton({
  text,
  className,
}: {
  text: string;
  className?: string;
  buttonLabel?: string;
}) {
  return <ClickableNotesCard text={text} className={className} />;
}

