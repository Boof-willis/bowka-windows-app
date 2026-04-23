import type { Window } from "@/types/db";

export type WindowTag =
  | `type:${string}`
  | `fin:${string}`
  | "tempered"
  | "obscured"
  | "grid"
  | "tinted"
  | `tint:${string}`
  | "storms"
  | "wraps";

export function windowTags(w: Window): WindowTag[] {
  const tags: WindowTag[] = [`type:${w.window_type}`];
  if (w.fin_type) tags.push(`fin:${w.fin_type}`);
  if (w.tempered) tags.push("tempered");
  if (w.obscured) tags.push("obscured");
  if (w.grid) tags.push("grid");
  if (w.tinted) {
    tags.push("tinted");
    if (w.tint_color) tags.push(`tint:${w.tint_color.toLowerCase()}`);
  }
  if (w.storms) tags.push("storms");
  if (w.wraps) tags.push("wraps");
  return tags;
}

export const TAG_LABELS: Record<string, string> = {
  "type:picture": "Picture",
  "type:single_hung": "Single Hung",
  "type:double_hung": "Double Hung",
  "type:single_slider": "Single Slider",
  "type:double_slider": "Double Slider",
  "type:casement": "Casement",
  "type:awning": "Awning",
  "type:bay": "Bay",
  "type:bow": "Bow",
  "type:garden": "Garden",
  "type:custom": "Custom",
  "fin:nail_fin": "Nail Fin",
  "fin:flush_fin": "Flush Fin",
  "fin:block_frame": "Block Frame",
  "fin:retrofit": "Retrofit",
  tempered: "Tempered",
  obscured: "Obscured",
  grid: "Grid",
  tinted: "Tinted",
  storms: "Storms",
  wraps: "Wraps",
};

export function tagLabel(tag: string): string {
  if (TAG_LABELS[tag]) return TAG_LABELS[tag];
  if (tag.startsWith("tint:")) return `Tint: ${tag.slice(5)}`;
  return tag;
}
