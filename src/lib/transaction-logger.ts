import { prisma } from "@/lib/prisma";
import { getCurrentSessionName } from "@/lib/admin-session";

export async function logTransactionChange(
  type: "deleted" | "modified",
  originalTx: any,
  modifiedTx?: any
) {
  try {
    const performedBy = await getCurrentSessionName();

    const partner = await prisma.creditBookPartner.findUnique({
      where: { id: originalTx.partnerId },
      select: { name: true }
    });

    const logEntry = {
      id: Math.random().toString(36).substring(2, 11),
      type,
      timestamp: new Date().toISOString(),
      partnerName: partner?.name || "شريك غير معروف",
      performedBy,
      originalTx: {
        id: originalTx.id,
        partnerId: originalTx.partnerId,
        amount: Number(originalTx.amount),
        kind: originalTx.kind,
        note: originalTx.note,
        imageUrl: originalTx.imageUrl,
        createdAt: originalTx.createdAt instanceof Date ? originalTx.createdAt.toISOString() : String(originalTx.createdAt),
      },
      modifiedTx: modifiedTx ? {
        id: modifiedTx.id,
        partnerId: modifiedTx.partnerId,
        amount: Number(modifiedTx.amount),
        kind: modifiedTx.kind,
        note: modifiedTx.note,
        imageUrl: modifiedTx.imageUrl,
        createdAt: modifiedTx.createdAt instanceof Date ? modifiedTx.createdAt.toISOString() : String(modifiedTx.createdAt),
      } : null,
    };

    const setting = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: "credit_book", section: "transaction_history_logs" } }
    });

    let currentLogs: any[] = [];
    if (setting && setting.config && typeof setting.config === "object") {
      currentLogs = (setting.config as any).logs || [];
    }

    currentLogs = [logEntry, ...currentLogs].slice(0, 300); // Store up to 300 logs

    await prisma.uISystemSetting.upsert({
      where: { target_section: { target: "credit_book", section: "transaction_history_logs" } },
      create: {
        target: "credit_book",
        section: "transaction_history_logs",
        config: { logs: currentLogs }
      },
      update: {
        config: { logs: currentLogs }
      }
    });
  } catch (err) {
    console.error("Failed to log transaction change:", err);
  }
}

export async function logTransactionAuthor(
  transactionId: string,
  action: "create" | "update",
  authorName?: string
) {
  try {
    const name = authorName || (await getCurrentSessionName());

    const setting = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: "credit_book", section: "transaction_authors" } }
    });

    let config: any = {};
    if (setting && setting.config && typeof setting.config === "object") {
      config = setting.config;
    }

    if (action === "create") {
      config[transactionId] = {
        createdBy: name,
        createdAt: new Date().toISOString()
      };
    } else if (action === "update") {
      const existing = config[transactionId] || { createdBy: "الإدارة", createdAt: new Date().toISOString() };
      config[transactionId] = {
        ...existing,
        modifiedBy: name,
        updatedAt: new Date().toISOString()
      };
    }

    await prisma.uISystemSetting.upsert({
      where: { target_section: { target: "credit_book", section: "transaction_authors" } },
      create: {
        target: "credit_book",
        section: "transaction_authors",
        config
      },
      update: {
        config
      }
    });
  } catch (err) {
    console.error("Failed to log transaction author:", err);
  }
}

export async function getTransactionAuthors(): Promise<Record<string, { createdBy: string; modifiedBy?: string; createdAt: string; updatedAt?: string }>> {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: "credit_book", section: "transaction_authors" } }
    });
    if (setting && setting.config && typeof setting.config === "object") {
      return setting.config as any;
    }
    return {};
  } catch {
    return {};
  }
}
