import { prisma } from "@/lib/prisma";
import { setGlobalNoProfitKeywords, getGlobalNoProfitKeywords } from "./auto-pricing";

export async function loadNoProfitKeywordsFromServer(): Promise<string[]> {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: { target: "system", section: "pricing_config" }
      }
    });
    const config = (setting?.config as any) || {};
    if (Array.isArray(config.no_profit_keywords) && config.no_profit_keywords.length > 0) {
      setGlobalNoProfitKeywords(config.no_profit_keywords);
      return getGlobalNoProfitKeywords();
    }
  } catch (err) {
    console.error("Failed to fetch no_profit_keywords from DB:", err);
  }
  return getGlobalNoProfitKeywords();
}
