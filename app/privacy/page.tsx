import type { Metadata } from "next";
import { PrivacyScreen } from "@/components/PrivacyScreen";

export const metadata: Metadata = {
  title: "Privacy — TaxTrack",
  description: "How TaxTrack handles your email and encrypted records. The records are encrypted on your device before they are stored.",
};

export default function PrivacyPage() {
  return <PrivacyScreen />;
}
