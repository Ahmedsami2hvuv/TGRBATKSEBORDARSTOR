import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export async function handleOrderDelivered(orderId: string, customTx?: any) {
  const db = customTx || prisma;
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
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

    // أتمتة حساب وتسجيل ديون الزبائن في دفتر الديون إذا تم تسليم الطلب وكان الوارد المستلم أقل من المطلوب
    try {
      const isDelivered = order.status === "delivered";
      let customerId = order.customerId;
      const customerPhone = order.customerPhone ? order.customerPhone.trim() : "";

      const normPhone = customerPhone ? normalizeIraqMobileLocal11(customerPhone) : null;
      const cleanDigits = customerPhone ? customerPhone.replace(/\D/g, "") : "";
      const phoneVariants = [customerPhone, cleanDigits];
      if (normPhone) {
        phoneVariants.push(normPhone);
        if (normPhone.startsWith("0")) {
          phoneVariants.push("964" + normPhone.slice(1));
          phoneVariants.push(normPhone.slice(1));
        }
      }
      const uniquePhoneVariants = Array.from(new Set(phoneVariants.filter(Boolean)));

      if (!customerId && customerPhone) {
        let foundCust = await db.customer.findFirst({
          where: {
            phone: { in: uniquePhoneVariants },
            shopId: order.shopId
          }
        });

        if (!foundCust) {
          const custName = order.customerName?.trim() || "زبون";
          foundCust = await db.customer.create({
            data: {
              shopId: order.shopId,
              name: custName,
              phone: normPhone || customerPhone,
              customerRegionId: order.customerRegionId,
              customerLocationUrl: order.customerLocationUrl || "",
              customerLandmark: order.customerLandmark || "",
            }
          });
        }

        customerId = foundCust.id;
        await db.order.update({
          where: { id: order.id },
          data: { customerId: foundCust.id }
        });
      }

      if (customerId || uniquePhoneVariants.length > 0) {
        // حساب المبالغ المستلمة من المندوب للطلبية بنوع التوصيل (delivery_in)
        const agg = await db.orderCourierMoneyEvent.aggregate({
          where: {
            orderId,
            kind: "delivery_in",
            deletedAt: null,
          },
          _sum: { amountDinar: true },
        });

        const isPaidAll = Boolean(order.prepaidAll || order.customerPaymentReceivedAt !== null);
        const expectedDinar = Number(order.totalAmount || 0);
        const receivedDinar = Number(agg._sum.amountDinar || 0);
        const difference = expectedDinar - receivedDinar;

        if (isDelivered && difference > 0 && !isPaidAll) {
          // 1. البحث عن حساب دفتر الديون للزبون أو إنشائه
          let cbPartner = null;
          if (customerId) {
            cbPartner = await db.creditBookPartner.findUnique({
              where: {
                type_externalId: {
                  type: "customer",
                  externalId: customerId
                }
              }
            });
          }

          if (!cbPartner && uniquePhoneVariants.length > 0) {
            cbPartner = await db.creditBookPartner.findFirst({
              where: {
                type: "customer",
                phone: { in: uniquePhoneVariants }
              }
            });
            if (cbPartner && customerId && !cbPartner.externalId) {
              await db.creditBookPartner.update({
                where: { id: cbPartner.id },
                data: { externalId: customerId }
              });
            }
          }

          const actualCustomerName = (order.customerName && order.customerName.trim()) 
            || (order.customer && order.customer.name && order.customer.name.trim() !== "زبون" ? order.customer.name.trim() : "") 
            || "زبون";

          if (!cbPartner) {
            cbPartner = await db.creditBookPartner.create({
              data: {
                name: actualCustomerName,
                phone: order.customerPhone || order.customer?.phone || (normPhone || null),
                type: "customer",
                externalId: customerId || null,
                updatedAt: new Date()
              }
            });
          } else {
            const shouldUpdateName = (cbPartner.name === "زبون" || !cbPartner.name) && actualCustomerName !== "زبون";
            await db.creditBookPartner.update({
              where: { id: cbPartner.id },
              data: {
                updatedAt: new Date(),
                ...(shouldUpdateName ? { name: actualCustomerName } : {}),
                ...(!cbPartner.phone && (order.customerPhone || order.customer?.phone) ? { phone: order.customerPhone || order.customer?.phone } : {})
              }
            });
          }

          // 2. التحقق من وجود المعاملة بالفعل لتفادي التكرار
          const exists = await db.creditBookTransaction.findFirst({
            where: {
              partnerId: cbPartner.id,
              note: {
                contains: `#${order.orderNumber}`
              }
            }
          });

          const regionName = order.customerRegion?.name || "غير محدد";
          const courierName = order.courier?.name || "بدون مندوب";
          const orderType = order.orderType || "توصيل";
          const shopName = order.shop?.name || "المتجر";
          const phoneDisplay = order.customerPhone || order.customer?.phone || "بدون هاتف";
          const nameDisplay = actualCustomerName;

          const noteText = `طلب رقم: #${order.orderNumber} | نطلبه (دين تسليم) | المتجر: ${shopName} | الزبون: ${nameDisplay} (${phoneDisplay}) | المنطقة: ${regionName} | المندوب: ${courierName} | نوع الطلب: ${orderType} | المطلوب الكلي: ${expectedDinar.toLocaleString()} د.ع | الوارد المستلم: ${receivedDinar.toLocaleString()} د.ع | المتبقي بذمته: ${difference.toLocaleString()} د.ع`;

          if (exists) {
            await db.creditBookTransaction.update({
              where: { id: exists.id },
              data: {
                amount: difference,
                kind: "gave",
                note: noteText,
              }
            });
          } else {
            const newTx = await db.creditBookTransaction.create({
              data: {
                partnerId: cbPartner.id,
                amount: difference,
                kind: "gave", // أعطيته = نطلبه
                note: noteText,
                createdAt: order.createdAt
              }
            });

            try {
              const { logTransactionAuthor } = await import("./transaction-logger");
              await logTransactionAuthor(newTx.id, "create", "النظام");
            } catch (logErr) {
              console.error("Failed to log transaction creator as System:", logErr);
            }
          }
        } else {
          // إذا لم يعد الطلب مسلماً أو تلاشى الفرق (تم استلام الوارد كاملاً) أو أصبح مدفوعاً بالكامل:
          // نبحث عن أي معاملة قديمة لهذا الطلب ونحذفها لتصفير الدين
          let cbPartner = null;
          if (customerId) {
            cbPartner = await db.creditBookPartner.findUnique({
              where: {
                type_externalId: {
                  type: "customer",
                  externalId: customerId
                }
              }
            });
          }
          if (!cbPartner && uniquePhoneVariants.length > 0) {
            cbPartner = await db.creditBookPartner.findFirst({
              where: {
                type: "customer",
                phone: { in: uniquePhoneVariants }
              }
            });
          }

          if (cbPartner) {
            const exists = await db.creditBookTransaction.findFirst({
              where: {
                partnerId: cbPartner.id,
                note: {
                  contains: `#${order.orderNumber}`
                }
              }
            });

            if (exists) {
              await db.creditBookTransaction.delete({
                where: { id: exists.id }
              });
            }
          }
        }
      }
    } catch (customerDebtErr) {
      console.error("Failed to auto record customer debt on delivery:", customerDebtErr);
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
              amount: totalBuyDinar,
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
              amount: totalBuyDinar,
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
              amount: totalBuyDinar,
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
          if (exists.note !== noteText || Number(exists.amount) !== totalBuyDinar) {
            await db.creditBookTransaction.update({
              where: { id: exists.id },
              data: {
                amount: totalBuyDinar,
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
