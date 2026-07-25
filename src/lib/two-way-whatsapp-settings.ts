import { prisma } from "@/lib/prisma";
import {
  type TwoWayTemplatesConfig,
  type TwoWayButtonRule,
  getDefaultTwoWayLocationSenderTemplate,
  getDefaultTwoWayLocationRecipientTemplate,
  getDefaultTwoWayNotifySenderTemplate,
  getDefaultTwoWayNotifyRecipientTemplate,
  getDefaultTwoWayChatSenderTemplate,
  getDefaultTwoWayChatRecipientTemplate,
  getDefaultTwoWayButtonRules,
} from "./two-way-whatsapp-helpers";

export * from "./two-way-whatsapp-helpers";

const TARGET = "admin";
const SECTION_TWO_WAY_LOCATION_SENDER = "whatsapp_twoway_location_sender_template";
const SECTION_TWO_WAY_LOCATION_RECIPIENT = "whatsapp_twoway_location_recipient_template";
const SECTION_TWO_WAY_NOTIFY_SENDER = "whatsapp_twoway_notify_sender_template";
const SECTION_TWO_WAY_NOTIFY_RECIPIENT = "whatsapp_twoway_notify_recipient_template";
const SECTION_TWO_WAY_CHAT_SENDER = "whatsapp_twoway_chat_sender_template";
const SECTION_TWO_WAY_CHAT_RECIPIENT = "whatsapp_twoway_chat_recipient_template";
const SECTION_TWO_WAY_BUTTON_RULES = "whatsapp_twoway_button_rules";

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
            SECTION_TWO_WAY_BUTTON_RULES,
          ],
        },
      },
    });

    const map = new Map<string, any>();
    for (const r of rows) {
      const cfg = r.config as any;
      if (cfg?.text !== undefined) {
        map.set(r.section, cfg.text);
      } else if (cfg?.rules !== undefined) {
        map.set(r.section, cfg.rules);
      }
    }

    const savedRules = map.get(SECTION_TWO_WAY_BUTTON_RULES);

    return {
      locationSenderTemplate: map.get(SECTION_TWO_WAY_LOCATION_SENDER) || getDefaultTwoWayLocationSenderTemplate(),
      locationRecipientTemplate: map.get(SECTION_TWO_WAY_LOCATION_RECIPIENT) || getDefaultTwoWayLocationRecipientTemplate(),
      notifySenderTemplate: map.get(SECTION_TWO_WAY_NOTIFY_SENDER) || getDefaultTwoWayNotifySenderTemplate(),
      notifyRecipientTemplate: map.get(SECTION_TWO_WAY_NOTIFY_RECIPIENT) || getDefaultTwoWayNotifyRecipientTemplate(),
      chatSenderTemplate: map.get(SECTION_TWO_WAY_CHAT_SENDER) || getDefaultTwoWayChatSenderTemplate(),
      chatRecipientTemplate: map.get(SECTION_TWO_WAY_CHAT_RECIPIENT) || getDefaultTwoWayChatRecipientTemplate(),
      buttonRules: Array.isArray(savedRules) && savedRules.length > 0 ? savedRules : getDefaultTwoWayButtonRules(),
    };
  } catch {
    return {
      locationSenderTemplate: getDefaultTwoWayLocationSenderTemplate(),
      locationRecipientTemplate: getDefaultTwoWayLocationRecipientTemplate(),
      notifySenderTemplate: getDefaultTwoWayNotifySenderTemplate(),
      notifyRecipientTemplate: getDefaultTwoWayNotifyRecipientTemplate(),
      chatSenderTemplate: getDefaultTwoWayChatSenderTemplate(),
      chatRecipientTemplate: getDefaultTwoWayChatRecipientTemplate(),
      buttonRules: getDefaultTwoWayButtonRules(),
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

  if (config.buttonRules !== undefined) {
    tasks.push(
      prisma.uISystemSetting.upsert({
        where: { target_section: { target: TARGET, section: SECTION_TWO_WAY_BUTTON_RULES } },
        create: { target: TARGET, section: SECTION_TWO_WAY_BUTTON_RULES, config: { rules: config.buttonRules } },
        update: { config: { rules: config.buttonRules } },
      })
    );
  }

  await Promise.all(tasks);
}
