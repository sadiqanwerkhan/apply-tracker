"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Row } from "@/lib/types";
import { triggerClass } from "./shared";

// Lets the user delete an application they consider garbage (noise emails that
// slipped through classification). Confirms first, then deletes from the database
// and reloads the list. Emails are unlinked, not destroyed (see the delete API),
// so this is a safe prune, not a data wipe.
export function DeleteButton({ row }: { row: Row }) {
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  async function remove() {
    if (deleting) return;
    if (!confirm(`Delete "${row.company}" from your applications? This removes it from your list and database. (If a future scan finds matching emails, it may reappear.)`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/application/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      if (res.ok) {
        // Smoothly refresh the list from cache — no full page reload.
        await queryClient.invalidateQueries({ queryKey: ["applications"] });
      } else {
        alert("Couldn't delete this application. Please try again.");
        setDeleting(false);
      }
    } catch {
      alert("Something went wrong. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={deleting}
      className={`${triggerClass(false)} hover:border-danger/40 hover:text-danger disabled:opacity-50`}
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
