import { prisma } from "@/lib/prisma";

const TARGET = "admin";
const SECTION = "whatsapp_employee_share_template";

export const WHATSAPP_TEMPLATE_VARIABLES = [
  "{customerName}",
  "{shopName}",
  "{customerLink}",
  "{shopLocation}",
] as const;

type WhatsappTemplateConfig = {
  employeeShareTemplate?: string;
};

export function getDefaultEmployeeWhatsappShareTemplate(): string {
  return [
    "مرحبا بك {customerName}",
    "من محل {shopName}",
    "رابط حسابكم بتطبيق الطلب هو:",
    "{customerLink}",
    "",
    "نتشرف بخدمتكم دائماً",
  ].join("\n");
}

export async function getEmployeeWhatsappShareTemplate(): Promise<string> {
  try {
    const row = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: TARGET, section: SECTION } },
      select: { config: true },
    });
    const config = (row?.config ?? null) as WhatsappTemplateConfig | null;
    const template = config?.employeeShareTemplate?.trim();
    return template || getDefaultEmployeeWhatsappShareTemplate();
  } catch {
    return getDefaultEmployeeWhatsappShareTemplate();
  }
}

export async function saveEmployeeWhatsappShareTemplate(template: string): Promise<void> {
  const normalized = template.trim() || getDefaultEmployeeWhatsappShareTemplate();
  await prisma.uISystemSetting.upsert({
    where: { target_section: { target: TARGET, section: SECTION } },
    create: { target: TARGET, section: SECTION, config: { employeeShareTemplate: normalized } },
    update: { config: { employeeShareTemplate: normalized } },
  });
}

export function renderEmployeeWhatsappShareTemplate(input: {
  template: string;
  customerName: string;
  shopName: string;
  customerLink: string;
  shopLocation?: string | null;
}): string {
  const text = input.template.trim() || getDefaultEmployeeWhatsappShareTemplate();
  return text
    .replaceAll("{customerName}", input.customerName)
    .replaceAll("{employee}", input.customerName)
    .replaceAll("{shopName}", input.shopName)
    .replaceAll("{shop}", input.shopName)
    .replaceAll("{customerLink}", input.customerLink)
    .replaceAll("{orderPortal}", input.customerLink)
    .replaceAll("{portal}", input.customerLink)
    .replaceAll("{shopLocation}", input.shopLocation?.trim() || "")
    .replaceAll("{location}", input.shopLocation?.trim() || "")
    .replaceAll("\\n", "\n");
}
