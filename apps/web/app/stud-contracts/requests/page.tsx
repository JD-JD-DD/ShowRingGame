import { redirect } from "next/navigation";

export default function PendingStudRequestsPage() {
  redirect("/stud-contracts?action=manual-approval");
}
