import { prisma } from "@/lib/prisma";

const TARGET = "admin";
const SECTION_EMPLOYEE_SHARE = "whatsapp_employee_share_template";
const SECTION_CUSTOMER_ORDER = "whatsapp_customer_order_template";

export const WHATSAPP_TEMPLATE_VARIABLES = [
  "{customerName}",
  "{shopName}",
  "{customerLink}",
  "{shopLocation}",
  "{orderItems}",
  "{regionName}",
  "{orderNumber}",
] as const;

type WhatsappTemplateConfig = {
  employeeShareTemplate?: string;
  customerOrderTemplate?: string;
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

export function getDefaultCustomerOrderTemplate(): string {
  return [
    "مرحبا لقد طلبت من {shopName}",
    "المنطقة: {regionName}",
    "منتجاتي هي:",
    "{orderItems}",
    "",
    "ارجو تجهيز الطلب",
    "شكرا لكم",
  ].join("\n");
}

export async function getEmployeeWhatsappShareTemplate(): Promise<string> {
  try {
    const row = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: TARGET, section: SECTION_EMPLOYEE_SHARE } },
      select: { config: true },
    });
    const config = (row?.config ?? null) as WhatsappTemplateConfig | null;
    return config?.employeeShareTemplate?.trim() || getDefaultEmployeeWhatsappShareTemplate();
  } catch {
    return getDefaultEmployeeWhatsappShareTemplate();
  }
}

export async function getCustomerOrderWhatsappTemplate(): Promise<string> {
  try {
    const row = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: TARGET, section: SECTION_CUSTOMER_ORDER } },
      select: { config: true },
    });
    const config = (row?.config ?? null) as WhatsappTemplateConfig | null;
    return config?.customerOrderTemplate?.trim() || getDefaultCustomerOrderTemplate();
  } catch {
    return getDefaultCustomerOrderTemplate();
  }
}

export async function saveEmployeeWhatsappShareTemplate(template: string): Promise<void> {
  const normalized = template.trim() || getDefaultEmployeeWhatsappShareTemplate();
  await prisma.uISystemSetting.upsert({
    where: { target_section: { target: TARGET, section: SECTION_EMPLOYEE_SHARE } },
    create: { target: TARGET, section: SECTION_EMPLOYEE_SHARE, config: { employeeShareTemplate: normalized } },
    update: { config: { employeeShareTemplate: normalized } },
  });
}

export async function saveCustomerOrderWhatsappTemplate(template: string): Promise<void> {
  const normalized = template.trim() || getDefaultCustomerOrderTemplate();
  await prisma.uISystemSetting.upsert({
    where: { target_section: { target: TARGET, section: SECTION_CUSTOMER_ORDER } },
    create: { target: TARGET, section: SECTION_CUSTOMER_ORDER, config: { customerOrderTemplate: normalized } },
    update: { config: { customerOrderTemplate: normalized } },
  });
}

export function renderWhatsappTemplate(input: {
  template: string;
  customerName?: string;
  shopName?: string;
  customerLink?: string;
  shopLocation?: string | null;
  orderItems?: string;
  regionName?: string;
  orderNumber?: string | number;
}): string {
  let text = input.template.trim();

  const replacements: Record<string, string> = {
    "{customerName}": input.customerName || "",
    "{employee}": input.customerName || "",
    "{shopName}": input.shopName || "",
    "{shop}": input.shopName || "",
    "{customerLink}": input.customerLink || "",
    "{orderPortal}": input.customerLink || "",
    "{portal}": input.customerLink || "",
    "{shopLocation}": input.shopLocation?.trim() || "",
    "{location}": input.shopLocation?.trim() || "",
    "{orderItems}": input.orderItems || "",
    "{regionName}": input.regionName || "",
    "{orderNumber}": String(input.orderNumber || ""),
    "\\n": "\n",
  };

  Object.entries(replacements).forEach(([key, val]) => {
    text = text.replaceAll(key, val);
  });

  return text;
}
