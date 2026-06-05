import { prisma } from "./prisma";
import fs from "fs";
import path from "path";

/**
 * يسترجع اسم الخط المختار من قاعدة البيانات.
 * إذا لم يوجد، يعود بالخط الافتراضي "Cairo-Regular".
 */
export async function getChosenFont(): Promise<string> {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: { target: "global", section: "font" }
      }
    });

    if (!setting) return "Cairo-Regular";
    const config = setting.config as { fontName: string };
    return config.fontName || "Cairo-Regular";
  } catch (e) {
    console.error("Error fetching chosen font:", e);
    return "Cairo-Regular";
  }
}

/**
 * يحفظ اسم الخط المختار في قاعدة البيانات.
 */
export async function setChosenFont(fontName: string) {
  return await prisma.uISystemSetting.upsert({
    where: {
      target_section: { target: "global", section: "font" }
    },
    update: { config: { fontName } },
    create: { target: "global", section: "font", config: { fontName } }
  });
}

/**
 * يقرأ الملفات في مجلد fonts ويعيد أسماءها (بدون اللاحقة) كخطوط متاحة.
 */
export function getAvailableFonts(): string[] {
  try {
    const root = process.cwd();
    const fontsDir = path.join(root, "public", "fonts");

    // التحقق من أن المسار string قبل الاستخدام
    if (typeof fontsDir !== 'string') return [];
    if (!fs.existsSync(fontsDir)) return [];

    const files = fs.readdirSync(fontsDir);
    return files
      .filter(file => /\.(ttf|otf|woff|woff2|eot|svg|ttc|dfont)$/i.test(file))
      .map(file => path.parse(file).name);
  } catch (e) {
    console.error("Error listing available fonts:", e);
    return [];
  }
}

/**
 * يعيد المسار النسبي لملف الخط بناءً على اسمه.
 */
export function getFontFileUrl(fontName: string): string | null {
  try {
    const root = process.cwd();
    const fontsDir = path.join(root, "public", "fonts");

    if (typeof fontsDir !== 'string' || !fs.existsSync(fontsDir)) return null;

    const files = fs.readdirSync(fontsDir);
    const file = files.find(f => path.parse(f).name === fontName);
    return file ? `/fonts/${file}` : null;
  } catch (e) {
    return null;
  }
}
