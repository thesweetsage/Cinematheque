"use server";
import { updateTag } from "next/cache";
import { requireMember } from "@/lib/member";
import { db } from "@/lib/supabase";
import { titleTag } from "@/lib/titleExtras";

/* The booklet's "mark checked" button. Writing the notes goes through /api/notes (it takes a minute). */

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
