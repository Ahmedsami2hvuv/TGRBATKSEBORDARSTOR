import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export async function handleOrderDelivered(orderId: string, customTx?: any) {
  const db = customTx || prisma;
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        customerRegion: { select: { name: true } },
        courier: { select: { name: true, vehicleType: true, zeroEarning: true } },
        shop: { select: { name: true } }
      }
    });

    if (!order) return;

    // حساب وتخزين أرباح المندوب تلقائياً في قاعدة البيانات إذا لم تكن مخزنة سابقاً
    if (order.assignedCourierId && order.courier && order.courierEarningForCourierId == null) {
      const { computeCourierDeliveryEarningDinar } = await import("./courier-earnings");
      const earning = order.deliveryPrice != null
        ? computeCourierDeliveryEarningDinar(
            order.courier.vehicleType,
            order.deliveryPrice,
            order.courier.zeroEarning
          )
        : null;

      await db.order.update({
        where: { id: orderId },
        data: {
          courierEarningDinar: earning,
          courierEarningForCourierId: earning != null ? order.assignedCourierId : null,
        }
      });
    }

    // تم إلغاء أتمتة فتح واستعادة حسابات المحلات التلقائية في دفتر الديون عند تسليم الطلبات
    // لضمان بقاء دفتر الديون محاسبياً ومضبوطاً يدوياً بدون أي ديون عشوائية.

    // تم إلغاء أتمتة حساب وتعديل وحذف ديون الزبائن التلقائية في دفتر الديون عند تسليم الطلبات
    // لمنع أي تصفير خاطئ للعملاء أو قلب الحسابات بدون إدخال صريح من الإدارة.

    let products: any[] = [];
    if (order.preparerShoppingJson) {
      const parsed = typeof order.preparerShoppingJson === "string"
        ? JSON.parse(order.preparerShoppingJson)
        : order.preparerShoppingJson;
      products = (parsed as any)?.products || [];
    }

    if (products.length === 0) return;

    // Group products by their assignedPreparerId
    const preparerIds = Array.from(new Set(
      products
        .map(p => typeof p.assignedPreparerId === "string" ? p.assignedPreparerId.trim() : null)
        .filter(Boolean)
    )) as string[];

    if (preparerIds.length === 0) return;

    // Fetch suppliers matching these IDs
    const suppliers = await db.storeSupplier.findMany({
      where: { id: { in: preparerIds } }
    });

    // For each supplier, group the products they prepared and calculate total buy price
    for (const supplier of suppliers) {
      const supplierProducts = products.filter(p => p.assignedPreparerId?.trim() === supplier.id);
      if (supplierProducts.length === 0) continue;

      let totalBuyAlf = 0;
      const productLines: string[] = [];

      for (const p of supplierProducts) {
        const effectiveCost = (p.actualBuyAlf != null && !isNaN(Number(p.actualBuyAlf)) && Number(p.actualBuyAlf) >= 0)
          ? Number(p.actualBuyAlf)
          : Number(p.buyAlf || 0);
        totalBuyAlf += effectiveCost;
        if (p.actualBuyAlf != null && Number(p.actualBuyAlf) !== Number(p.buyAlf || 0)) {
          productLines.push(`${p.line} (${effectiveCost.toLocaleString()} ألف [خصم])`);
        } else {
          productLines.push(`${p.line} (${effectiveCost.toLocaleString()} ألف)`);
        }
      }

      const totalBuyDinar = totalBuyAlf * 1000;

      // Check if this supplier has a credit book partner account, if not, create one!
      let cbPartner = await db.creditBookPartner.findUnique({
        where: {
          type_externalId: {
            type: "supplier",
            externalId: supplier.id
          }
        }
      });

      if (!cbPartner) {
        try {
          cbPartner = await db.creditBookPartner.create({
            data: {
              name: `${supplier.name} (مورد)`,
              phone: supplier.phone || null,
              type: "supplier",
              externalId: supplier.id,
              updatedAt: new Date()
            }
          });
        } catch (createPartnerErr) {
          console.error(`Failed to auto-create CreditBookPartner for supplier ${supplier.name} on delivery:`, createPartnerErr);
        }
      }

      if (cbPartner) {
        const regionName = order.customerRegion?.name || "غير محدد";
        const orderNumber = order.orderNumber;
        const productsText = productLines.join("، ");
        const courierName = order.courier?.name || "بدون مندوب";

        // Check if transaction was already recorded for this order to prevent duplicates!
        const exists = await db.creditBookTransaction.findFirst({
          where: {
            partnerId: cbPartner.id,
            note: {
              contains: `طلب رقم: #` + orderNumber
            }
          }
        });

        // لا تُسجّل معاملات المورد إذا كان سعر الشراء صفر؛ وإذا صارت المعاملة القديمة صفر نحذفها.
        if (totalBuyAlf <= 0) {
          if (exists) {
            await db.creditBookTransaction.delete({ where: { id: exists.id } });
          }
        } else if (!exists) {
          // Record automatic transaction: kind is "took" (أخذت - يطلبنا) because supplier prepared the goods, so we owe them.
          const noteText = `منطقة: ${regionName} | طلب رقم: #` + orderNumber + ` | منتجات: ${productsText} | سعر شراءها: ${totalBuyDinar.toLocaleString()} د.ع | المندوب: ${courierName}`;
          
          const newTx = await db.creditBookTransaction.create({
            data: {
              partnerId: cbPartner.id,
              amount: totalBuyAlf,
              kind: "took",
              note: noteText,
            }
          });

          // تسجيل منشئ المعاملة بالنظام
          try {
            const { logTransactionAuthor } = await import("./transaction-logger");
            await logTransactionAuthor(newTx.id, "create", "النظام");
          } catch (logErr) {
            console.error("Failed to log transaction creator as System:", logErr);
          }

          // تحديث تاريخ الشريك ليصعد في القائمة
          await db.creditBookPartner.update({
            where: { id: cbPartner.id },
            data: { updatedAt: new Date() }
          });
        } else {
          // تحديث المعاملة الحالية بالقيم والأسعار والملاحظات الجديدة
          const noteText = `منطقة: ${regionName} | طلب رقم: #` + orderNumber + ` | منتجات: ${productsText} | سعر شراءها: ${totalBuyDinar.toLocaleString()} د.ع | المندوب: ${courierName}`;
          await db.creditBookTransaction.update({
            where: { id: exists.id },
            data: {
              amount: totalBuyAlf,
              note: noteText,
            }
          });

          // تحديث تاريخ الشريك ليصعد في القائمة
          await db.creditBookPartner.update({
            where: { id: cbPartner.id },
            data: { updatedAt: new Date() }
          });
        }
      }
    }

    // أتمتة إغلاق وتحديث مسودات التجهيز المرتبطة بالطلب إلى حالة sent
    try {
      const normPhone = order.customerPhone ? normalizeIraqMobileLocal11(order.customerPhone) : null;
      const phoneDigits = order.customerPhone ? order.customerPhone.replace(/\D/g, "") : "";
      
      const phoneOrConditions = Array.from(new Set([
        order.customerPhone,
        normPhone,
        phoneDigits
      ].filter(Boolean))).map(p => ({ customerPhone: p as string }));

      await db.companyPreparerShoppingDraft.updateMany({
        where: {
          OR: [
            { sentOrderId: orderId },
            ...(phoneOrConditions.length > 0 ? [{
              OR: phoneOrConditions,
              status: { in: ["draft", "priced"] }
            }] : [])
          ]
        },
        data: {
          status: "sent",
          sentOrderId: orderId
        }
      });
    } catch (draftErr) {
      console.error("Failed to mark associated shopping drafts as sent on delivery:", draftErr);
    }
  } catch (error) {
    console.error("Error in handleOrderDelivered hook:", error);
  }
}

export async function syncSupplierTransactions(supplierId: string, customTx?: any) {
  const db = customTx || prisma;
  try {
    const orders = await db.order.findMany({
      where: {
        status: { notIn: ["draft", "priced", "cancelled"] },
        preparerShoppingJson: { contains: supplierId }
      },
      include: {
        customerRegion: { select: { name: true } },
        courier: { select: { name: true } },
      }
    });

    let cbPartner = await db.creditBookPartner.findUnique({
      where: {
        type_externalId: {
          type: "supplier",
          externalId: supplierId
        }
      }
    });

    if (!cbPartner) {
      try {
        const supplier = await db.storeSupplier.findUnique({ where: { id: supplierId } });
        if (supplier) {
          cbPartner = await db.creditBookPartner.create({
            data: {
              name: `${supplier.name} (مورد)`,
              phone: supplier.phone || null,
              type: "supplier",
              externalId: supplierId,
              updatedAt: new Date()
            }
          });
        }
      } catch (createPartnerErr) {
        console.error(`Failed to auto-create CreditBookPartner for supplierId ${supplierId} on sync:`, createPartnerErr);
      }
    }

    if (cbPartner) {
      // 1. تنظيف المعاملات القديمة التي ألغيت طلباتها أو تغير موردها
      try {
        const allSupplierTxs = await db.creditBookTransaction.findMany({
          where: {
            partnerId: cbPartner.id,
            note: { contains: "طلب رقم: #" }
          }
        });

        const orderNums: number[] = [];
        const txMap = new Map<number, typeof allSupplierTxs[0]>();
        for (const tx of allSupplierTxs) {
          const match = tx.note?.match(/طلب رقم:\s*#(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            orderNums.push(num);
            txMap.set(num, tx);
          }
        }

        if (orderNums.length > 0) {
          const matchingOrders = await db.order.findMany({
            where: { orderNumber: { in: orderNums } },
            select: { orderNumber: true, status: true, preparerShoppingJson: true }
          });
          const matchingMap = new Map(matchingOrders.map((o: any) => [o.orderNumber, o]));

          for (const num of orderNums) {
            const order: any = matchingMap.get(num);
            const tx = txMap.get(num);
            if (!tx) continue;

            let shouldDelete = false;
            if (!order || ["draft", "priced", "cancelled"].includes(order.status)) {
              shouldDelete = true;
            } else {
              let products: any[] = [];
              let parsed: any = {};
              try {
                parsed = typeof order.preparerShoppingJson === "string"
                  ? JSON.parse(order.preparerShoppingJson)
                  : order.preparerShoppingJson || {};
                products = parsed?.products || [];
              } catch {
                products = [];
              }

              const isStillSupplier = products.some(
                (p: any) => typeof p.assignedPreparerId === "string" && p.assignedPreparerId.trim() === supplierId
              );

              if (!isStillSupplier || parsed?.supplierDebtDeleted || parsed?.supplierDebtHidden) {
                shouldDelete = true;
              }
            }

            if (shouldDelete) {
              await db.creditBookTransaction.delete({
                where: { id: tx.id }
              });
            }
          }
        }
      } catch (cleanupErr) {
        console.error("Cleanup failed in syncSupplierTransactions:", cleanupErr);
      }

      // 2. مزامنة وإضافة المعاملات الجديدة
      for (const order of orders) {
        let products: any[] = [];
        let preparerShopping: any = {};
        try {
          preparerShopping = typeof order.preparerShoppingJson === "string"
            ? JSON.parse(order.preparerShoppingJson)
            : order.preparerShoppingJson || {};
          products = preparerShopping?.products || [];
        } catch {
          continue;
        }

        if (preparerShopping?.supplierDebtDeleted || preparerShopping?.supplierDebtHidden) {
          continue;
        }

        const supplierProducts = products.filter(
          (p: any) => typeof p.assignedPreparerId === "string" && p.assignedPreparerId.trim() === supplierId
        );

        if (supplierProducts.length === 0) continue;

        let totalBuyAlf = 0;
        const productLines: string[] = [];
        for (const p of supplierProducts) {
          const effectiveCost = (p.actualBuyAlf != null && !isNaN(Number(p.actualBuyAlf)) && Number(p.actualBuyAlf) >= 0)
            ? Number(p.actualBuyAlf)
            : Number(p.buyAlf || 0);
          totalBuyAlf += effectiveCost;
          if (p.actualBuyAlf != null && Number(p.actualBuyAlf) !== Number(p.buyAlf || 0)) {
            productLines.push(`${p.line} (${effectiveCost.toLocaleString()} ألف [خصم])`);
          } else {
            productLines.push(`${p.line} (${effectiveCost.toLocaleString()} ألف)`);
          }
        }

        const totalBuyDinar = totalBuyAlf * 1000;
        const regionName = order.customerRegion?.name || "غير محدد";
        const orderNumber = order.orderNumber;
        const productsText = productLines.join("، ");
        const courierName = order.courier?.name || "بدون مندوب";

        const exists = await db.creditBookTransaction.findFirst({
          where: {
            partnerId: cbPartner.id,
            note: {
              contains: `طلب رقم: #` + orderNumber
            }
          }
        });

        const noteText = `منطقة: ${regionName} | طلب رقم: #` + orderNumber + ` | منتجات: ${productsText} | سعر شراءها: ${totalBuyDinar.toLocaleString()} د.ع | المندوب: ${courierName}`;

        // لا تُنشأ/تُبقى معاملة مورد بسعر صفر.
        if (totalBuyAlf <= 0) {
          if (exists) {
            await db.creditBookTransaction.delete({ where: { id: exists.id } });
          }
        } else if (!exists) {
          const newTx = await db.creditBookTransaction.create({
            data: {
              partnerId: cbPartner.id,
              amount: totalBuyAlf,
              kind: "took",
              note: noteText,
              createdAt: order.createdAt,
            }
          });

          try {
            const { logTransactionAuthor } = await import("./transaction-logger");
            await logTransactionAuthor(newTx.id, "create", "النظام");
          } catch (logErr) {
            console.error("Failed to log transaction creator as System:", logErr);
          }
        } else {
          if (exists.note !== noteText || Number(exists.amount) !== totalBuyAlf) {
            await db.creditBookTransaction.update({
              where: { id: exists.id },
              data: {
                amount: totalBuyAlf,
                note: noteText,
              }
            });
          }
        }
      }

      await db.creditBookPartner.update({
        where: { id: cbPartner.id },
        data: { updatedAt: new Date() }
      });
    }
  } catch (error) {
    console.error("Error in syncSupplierTransactions:", error);
  }
}
