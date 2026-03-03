import { notFound } from "next/navigation";
import { isValidCommoditySlug } from "@/lib/commodity-config";
import { CommodityProvider } from "@/contexts/CommodityContext";

export default async function CommodityLayout({
  params,
  children,
}: {
  params: Promise<{ commodity: string }>;
  children: React.ReactNode;
}) {
  const { commodity } = await params;

  if (!isValidCommoditySlug(commodity)) {
    notFound();
  }

  return <CommodityProvider slug={commodity}>{children}</CommodityProvider>;
}
