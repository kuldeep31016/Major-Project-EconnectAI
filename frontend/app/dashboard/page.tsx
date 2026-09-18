import { redirect } from "next/navigation";

/** The prototype "Overview" page is superseded by the Dashboard (/command). */
export default function DashboardRedirect() {
  redirect("/command");
}
