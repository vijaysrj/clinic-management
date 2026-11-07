import { notFound } from "next/navigation";
import { getBranchBySlug } from "@/lib/booking";

/** The clinic for a /c/<slug> page, or a 404. */
export async function clinicFromParams(params: Promise<{ slug: string }>) {
  const { slug } = await params;
  const clinic = await getBranchBySlug(decodeURIComponent(slug));
  if (!clinic) notFound();
  return clinic;
}
