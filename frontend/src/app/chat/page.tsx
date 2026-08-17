import { redirect } from "next/navigation";

export default function ChatRedirect() {
  // The workspace was restructured into two focused surfaces: Search (agent
  // research) and Library (your corpus). Old /chat links land on Search.
  redirect("/search");
}
