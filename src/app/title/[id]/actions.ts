"use server";
import { updateTag } from "next/cache";
import { requireMember } from "@/lib/member";
import { writeNotes } from "@/lib/notes/write";
import { db } from "@/lib/supabase";
import { titleTag } from "@/lib/titleExtras";

/* The booklet's buttons: write (or rewrite) the notes, and mark them checked. */

export async function writeBooklet(slug: string): Promise<{ error?: string }> {
  await requireMember();
  try {
    await writeNotes(slug);
    updateTag(titleTag(slug));
    return {};
  } catch (e) {
    console.error(`[notes] ${slug}:`, (e as Error).message);
    return { error: (e as Error).message };
  }
}

export async function markBooklet(slug: string, checked: boolean): Promise<{ error?: string }> {
  await requireMember();
  const client = db();
  if (!client) return { error: "The database isn't connected." };
  const { data: t } = await client.from("titles").select("id").eq("slug", slug).maybeSingle();
  if (!t) return { error: "That title isn't in the store." };
  const { error } = await client.from("title_notes").update({ status: checked ? "checked" : "draft", updated_at: new Date().toISOString() }).eq("title_id", t.id);
  if (error) return { error: error.message };
  updateTag(titleTag(slug));
  return {};
}
