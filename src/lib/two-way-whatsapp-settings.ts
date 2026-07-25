import { prisma } from "@/lib/prisma";

const TARGET = "admin";
const SECTION_TWO_WAY_LOCATION_SENDER = "whatsapp_twoway_location_sender_template";
const SECTION_TWO_WAY_LOCATION_RECIPIENT = "whatsapp_twoway_location_recipient_template";
const SECTION_TWO_WAY_NOTIFY_SENDER = "whatsapp_twoway_notify_sender_template";
const SECTION_TWO_WAY_NOTIFY_RECIPIENT = "whatsapp_twoway_notify_recipient_template";
const SECTION_TWO_WAY_CHAT_SENDER = "whatsapp_twoway_chat_sender_template";
const SECTION_TWO_WAY_CHAT_RECIPIENT = "whatsapp_twoway_chat_recipient_template";

export const TWO_WAY_TEMPLATE_VARIABLES = [
  "{orderNumber}",
  "{senderName}",
  "{senderPhone}",
  "{recipientName}",
  "{recipientPhone}",
  "{senderRegion}",
  "{recipientRegion}",
  "{subtotal}",
  "{delivery}",
  "{total}",
  "{notes}",
] as const;

export type TwoWayTemplatesConfig = {
  locationSenderTemplate: string;
  locationRecipientTemplate: string;
  notifySenderTemplate: string;
  notifyRecipientTemplate: string;
  chatSenderTemplate: string;
  chatRecipientTemplate: string;
};

export function getDefaultTwoWayLocationSenderTemplate(): string {
  return [
    "مرحباً (المرسل)،",
    "نرجو تزويدنا بموقعك الجغرافي (اللوكيشن) لاستلام الطلبية رقم {orderNumber}.",
    "منطقة الاستلام: {senderRegion}",
    "شكراً لتعاونكم مع شركة أبو الأكبر للتوصيل.",
  ].join("\n");
}

export function getDefaultTwoWayLocationRecipientTemplate(): string {
  return [
    "مرحباً (المستلم)،",
    "نرجو تزويدنا بموقعك الجغرافي (اللوكيشن) لتوصيل الطلبية رقم {orderNumber}.",
    "منطقة التوصيل: {recipientRegion}",
    "شكراً لتعاونكم مع شركة أبو الأكبر للتوصيل.",
  ].join("\n");
}

export function getDefaultTwoWayNotifySenderTemplate(): string {
  return [
    "مرحباً (المرسل)،",
    "نحيطكم علماً بأنه تم استلام الطلبية رقم {orderNumber} من موقعكم بنجاح وهي في الطريق للتوصيل إلى: {recipientRegion}.",
    "شكراً لاختياركم شركة أبو الأكبر للتوصيل.",
  ].join("\n");
}

export function getDefaultTwoWayNotifyRecipientTemplate(): string {
  return [
    "مرحباً (المستلم)،",
    "المندوب في الطريق إليك لتسليم الطلبية رقم {orderNumber}.",
    "منطقة التوصيل: {recipientRegion}",
    "المبلغ الكلي المطلوب: {total} د.ع",
    "يرجى التواجد واستلام الطلبية.",
  ].join("\n");
}

export function getDefaultTwoWayChatSenderTemplate(): string {
  return [
    "السلام عليكم،",
    "تواصل بخصوص الطلب رقم {orderNumber} (الوجهة الأولى - المرسل).",
    "يرجى التأكيد.",
  ].join("\n");
}

export function getDefaultTwoWayChatRecipientTemplate(): string {
  return [
    "السلام عليكم،",
    "تواصل بخصوص الطلب رقم {orderNumber} (الوجهة الثانية - المستلم).",
    "يرجى التأكيد.",
  ].join("\n");
}

export async function getTwoWayTemplates(): Promise<TwoWayTemplatesConfig> {
  try {
    const rows = await prisma.uISystemSetting.findMany({
      where: {
        target: TARGET,
        section: {
          in: [
            SECTION_TWO_WAY_LOCATION_SENDER,
            SECTION_TWO_WAY_LOCATION_RECIPIENT,
            SECTION_TWO_WAY_NOTIFY_SENDER,
            SECTION_TWO_WAY_NOTIFY_RECIPIENT,
            SECTION_TWO_WAY_CHAT_SENDER,
            SECTION_TWO_WAY_CHAT_RECIPIENT,
          ],
        },
      },
    });

    const map = new Map<string, string>();
    for (const r of rows) {
      const cfg = r.config as { text?: string } | null;
      if (cfg?.text) {
        map.set(r.section, cfg.text);
      }
    }

    return {
      locationSenderTemplate: map.get(SECTION_TWO_WAY_LOCATION_SENDER) || getDefaultTwoWayLocationSenderTemplate(),
      locationRecipientTemplate: map.get(SECTION_TWO_WAY_LOCATION_RECIPIENT) || getDefaultTwoWayLocationRecipientTemplate(),
      notifySenderTemplate: map.get(SECTION_TWO_WAY_NOTIFY_SENDER) || getDefaultTwoWayNotifySenderTemplate(),
      notifyRecipientTemplate: map.get(SECTION_TWO_WAY_NOTIFY_RECIPIENT) || getDefaultTwoWayNotifyRecipientTemplate(),
      chatSenderTemplate: map.get(SECTION_TWO_WAY_CHAT_SENDER) || getDefaultTwoWayChatSenderTemplate(),
      chatRecipientTemplate: map.get(SECTION_TWO_WAY_CHAT_RECIPIENT) || getDefaultTwoWayChatRecipientTemplate(),
    };
  } catch {
    return {
      locationSenderTemplate: getDefaultTwoWayLocationSenderTemplate(),
      locationRecipientTemplate: getDefaultTwoWayLocationRecipientTemplate(),
      notifySenderTemplate: getDefaultTwoWayNotifySenderTemplate(),
      notifyRecipientTemplate: getDefaultTwoWayNotifyRecipientTemplate(),
      chatSenderTemplate: getDefaultTwoWayChatSenderTemplate(),
      chatRecipientTemplate: getDefaultTwoWayChatRecipientTemplate(),
    };
  }
}

export async function saveTwoWayTemplates(config: Partial<TwoWayTemplatesConfig>): Promise<void> {
  const tasks: Array<Promise<unknown>> = [];

  if (config.locationSenderTemplate !== undefined) {
    const val = config.locationSenderTemplate.trim() || getDefaultTwoWayLocationSenderTemplate();
    tasks.push(
      prisma.uISystemSetting.upsert({
        where: { target_section: { target: TARGET, section: SECTION_TWO_WAY_LOCATION_SENDER } },
        create: { target: TARGET, section: SECTION_TWO_WAY_LOCATION_SENDER, config: { text: val } },
        update: { config: { text: val } },
      })
    );
  }

  if (config.locationRecipientTemplate !== undefined) {
    const val = config.locationRecipientTemplate.trim() || getDefaultTwoWayLocationRecipientTemplate();
    tasks.push(
      prisma.uISystemSetting.upsert({
        where: { target_section: { target: TARGET, section: SECTION_TWO_WAY_LOCATION_RECIPIENT } },
        create: { target: TARGET, section: SECTION_TWO_WAY_LOCATION_RECIPIENT, config: { text: val } },
        update: { config: { text: val } },
      })
    );
  }

  if (config.notifySenderTemplate !== undefined) {
    const val = config.notifySenderTemplate.trim() || getDefaultTwoWayNotifySenderTemplate();
    tasks.push(
      prisma.uISystemSetting.upsert({
        where: { target_section: { target: TARGET, section: SECTION_TWO_WAY_NOTIFY_SENDER } },
        create: { target: TARGET, section: SECTION_TWO_WAY_NOTIFY_SENDER, config: { text: val } },
        update: { config: { text: val } },
      })
    );
  }

  if (config.notifyRecipientTemplate !== undefined) {
    const val = config.notifyRecipientTemplate.trim() || getDefaultTwoWayNotifyRecipientTemplate();
    tasks.push(
      prisma.uISystemSetting.upsert({
        where: { target_section: { target: TARGET, section: SECTION_TWO_WAY_NOTIFY_RECIPIENT } },
        create: { target: TARGET, section: SECTION_TWO_WAY_NOTIFY_RECIPIENT, config: { text: val } },
        update: { config: { text: val } },
      })
    );
  }

  if (config.chatSenderTemplate !== undefined) {
    const val = config.chatSenderTemplate.trim() || getDefaultTwoWayChatSenderTemplate();
    tasks.push(
      prisma.uISystemSetting.upsert({
        where: { target_section: { target: TARGET, section: SECTION_TWO_WAY_CHAT_SENDER } },
        create: { target: TARGET, section: SECTION_TWO_WAY_CHAT_SENDER, config: { text: val } },
        update: { config: { text: val } },
      })
    );
  }

  if (config.chatRecipientTemplate !== undefined) {
    const val = config.chatRecipientTemplate.trim() || getDefaultTwoWayChatRecipientTemplate();
    tasks.push(
      prisma.uISystemSetting.upsert({
        where: { target_section: { target: TARGET, section: SECTION_TWO_WAY_CHAT_RECIPIENT } },
        create: { target: TARGET, section: SECTION_TWO_WAY_CHAT_RECIPIENT, config: { text: val } },
        update: { config: { text: val } },
      })
    );
  }

  await Promise.all(tasks);
}
