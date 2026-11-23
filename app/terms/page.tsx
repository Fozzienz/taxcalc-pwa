import type { Metadata } from "next";
import { TermsScreen } from "@/components/TermsScreen";

export const metadata: Metadata = {
  title: "Terms — TaxTrack",
  description: "Terms for using TaxTrack, a private Australian record-keeping organiser. Not a registered tax agent and not tax advice.",
};

export default function TermsPage() {
  return <TermsScreen />;
}
