import { redirect } from "next/navigation";

// Old address. Patient IDs are looked up from the landing page now.
export default function OldStatus() {
  redirect("/#status");
}
