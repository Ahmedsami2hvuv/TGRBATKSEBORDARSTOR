import { prisma } from "./prisma";
import fs from "fs";
import path from "path";

export async function getChosenFont(): Promise<string> {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: { target: "global", section: "font" }
      }
    });

    if (!setting) return "Cairo";
    return (setting.config as { fontName: string }).fontName || "Cairo";
  } catch (e) {
    return "Cairo";
  }
}

export async function setChosenFont(fontName: string) {
  return await prisma.uISystemSetting.upsert({
    where: {
      target_section: { target: "global", section: "font" }
    },
    update: { config: { fontName } },
    create: { target: "global", section: "font", config: { fontName } }
  });
}

export function getAvailableFonts(): string[] {
  const fontsDir = path.join(process.cwd(), "public", "fonts");
  if (!fs.existsSync(fontsDir)) return [];

  const files = fs.readdirSync(fontsDir);
  // نأخذ اسم الملف بدون اللاحقة كاسم للخط
  return files
    .filter(file => /\.(ttf|otf|woff|woff2)$/i.test(file))
    .map(file => path.parse(file).name);
}

export function getFontFileUrl(fontName: string): string | null {
  const fontsDir = path.join(process.cwd(), "public", "fonts");
  if (!fs.existsSync(fontsDir)) return null;

  const files = fs.readdirSync(fontsDir);
  const file = files.find(f => path.parse(f).name === fontName);
  return file ? `/fonts/${file}` : null;
}
