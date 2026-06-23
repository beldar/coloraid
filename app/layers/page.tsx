import { redirect } from "next/navigation";

// Layers are now part of the Studio (toggle on the home page).
export default function LayersRedirect() {
  redirect("/");
}
