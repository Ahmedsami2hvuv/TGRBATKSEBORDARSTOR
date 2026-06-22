import { prisma } from "@/lib/prisma";

export async function handleOrderDelivered(orderId: string, customTx?: any) {
  const db = customTx || prisma;
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        customerRegion: { select: { name: true } },
        courier: { select: { name: true } },
      }
    });

    if (!order) return;

    // أتمتة فتح/استعادة حساب المحل تلقائياً في دفتر الديون إذا كان لديه طلب مسلّم غير مسدّد
    try {
      const subtotal = Number(order.orderSubtotal || 0);
      if (subtotal > 0 && !order.shopCostPaidAt && order.shopId) {
        const shop = await db.shop.findUnique({
          where: { id: order.shopId },
          select: { name: true, phone: true }
        });
        if (shop) {
          const cbPartner = await db.creditBookPartner.findFirst({
            where: {
              externalId: order.shopId,
              type: { in: ["shop", "deleted_shop"] }
            }
          });

          if (!cbPartner) {
            await db.creditBookPartner.create({
              data: {
                name: `${shop.name} (محل/مجهز)`,
                phone: shop.phone || null,
                type: "shop",
                externalId: order.shopId,
                updatedAt: new Date()
              }
            });
          } else if (cbPartner.type === "deleted_shop") {
            await db.creditBookPartner.update({
              where: { id: cbPartner.id },
              data: {
                type: "shop",
                updatedAt: new Date()
              }
            });
          } else {
            // تحديث تاريخ التعديل ليصعد الحساب للأعلى
            await db.creditBookPartner.update({
              where: { id: cbPartner.id },
              data: {
                updatedAt: new Date()
              }
            });
          }
        }
      }
    } catch (partnerErr) {
      console.error("Failed to auto restore/create shop credit partner on delivery:", partnerErr);
    }

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
        totalBuyAlf += Number(p.buyAlf || 0);
        productLines.push(`${p.line} (${Number(p.buyAlf || 0).toLocaleString()} ألف)`);
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

        if (!exists) {
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
        }
      }
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
        preparerShoppingJson: { not: null }
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

        for (const tx of allSupplierTxs) {
          const match = tx.note?.match(/طلب رقم:\s*#(\d+)/);
          if (!match) continue;
          const orderNum = parseInt(match[1], 10);

          const order = await db.order.findFirst({
            where: { orderNumber: orderNum },
            select: { id: true, status: true, preparerShoppingJson: true }
          });

          let shouldDelete = false;

          if (!order) {
            shouldDelete = true;
          } else if (["draft", "priced", "cancelled"].includes(order.status)) {
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
          totalBuyAlf += Number(p.buyAlf || 0);
          productLines.push(`${p.line} (${Number(p.buyAlf || 0).toLocaleString()} ألف)`);
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

        if (!exists) {
          const noteText = `منطقة: ${regionName} | طلب رقم: #` + orderNumber + ` | منتجات: ${productsText} | سعر شراءها: ${totalBuyDinar.toLocaleString()} د.ع | المندوب: ${courierName}`;
          const newTx = await db.creditBookTransaction.create({
            data: {
              partnerId: cbPartner.id,
              amount: totalBuyAlf,
              kind: "took",
              note: noteText,
              createdAt: order.createdAt,
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
        }
      }
    }
  } catch (error) {
    console.error("Error in syncSupplierTransactions:", error);
  }
}
