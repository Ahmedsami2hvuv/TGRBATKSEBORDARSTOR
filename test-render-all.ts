import { prisma } from "./src/lib/prisma";
import { dinarDecimalToAlfInputString } from "./src/lib/money-alf";
import { courierAssignableWhere } from "./src/lib/courier-assignable";
import { normalizeIraqMobileLocal11 } from "./src/lib/whatsapp";

async function run() {
  console.log("Starting diagnostic scan of all orders...");
  try {
    const orders = await prisma.order.findMany({
      select: { id: true, orderNumber: true }
    });

    console.log(`Found ${orders.length} orders. Scanning each one...`);

    const [shops, regions, employeesAll] = await Promise.all([
      prisma.shop.findMany({
        include: { region: true },
      }),
      prisma.region.findMany(),
      prisma.employee.findMany({
        select: { id: true, shopId: true, name: true },
      }),
    ]);

    for (const shop of shops) {
      if (!shop.region) {
        console.error(`❌ Shop "${shop.name}" (ID: ${shop.id}) has NO region loaded!`);
      }
    }

    let errorCount = 0;

    for (const orderShort of orders) {
      try {
        const order = await prisma.order.findUnique({
          where: { id: orderShort.id },
          include: {
            shop: true,
            customerRegion: true,
            courier: true,
            submittedBy: { select: { id: true, name: true, phone: true } },
            submittedByCompanyPreparer: true,
            customer: true,
            moneyEvents: {
              orderBy: { createdAt: "asc" },
              include: {
                courier: { select: { name: true } },
                recordedByCompanyPreparer: { select: { name: true } },
              },
            },
          },
        });

        if (!order) continue;

        // Perform all mappings and calculations exactly like EditOrderPage
        const customerPhoneNorm = normalizeIraqMobileLocal11(order.customerPhone);
        const customerPhoneProfile =
          customerPhoneNorm && order.customerRegionId
            ? await prisma.customerPhoneProfile.findUnique({
                where: {
                  phone_regionId: {
                    phone: customerPhoneNorm,
                    regionId: order.customerRegionId,
                  },
                },
                select: { id: true, photoUrl: true, isBlocked: true },
              })
            : null;

        const getCustomerDoorUrl = () => {
          const fromCustomer = order.customer?.customerDoorPhotoUrl?.trim();
          if (fromCustomer?.startsWith("data:")) return null;
          if (fromCustomer) return fromCustomer;
          if (order.customerDoorPhotoUrl?.trim()?.startsWith("data:")) return `/api/image/order/${order.id}/customerDoor`;
          if (order.customerDoorPhotoUrl?.trim()) return order.customerDoorPhotoUrl;
          if (customerPhoneProfile?.photoUrl?.trim()?.startsWith("data:")) return `/api/image/customerPhoneProfile/${customerPhoneProfile.id}/photo`;
          return customerPhoneProfile?.photoUrl?.trim() || null;
        };
        const defaultCustomerDoorPhotoUrlEffective = getCustomerDoorUrl();

        const courierWhere = {
          OR: [
            courierAssignableWhere,
            ...(order.assignedCourierId ? [{ id: order.assignedCourierId }] : []),
          ],
        };

        const couriers = await prisma.courier.findMany({ where: courierWhere });

        const defaultSubmittedByEmployeeId =
          order.submittedByEmployeeId &&
          employeesAll.some(
            (e) => e.id === order.submittedByEmployeeId && e.shopId === order.shopId,
          )
            ? order.submittedByEmployeeId
            : "";

        const adminMoneyEvents = order.moneyEvents.map((e) => ({
          id: e.id,
          kind: e.kind,
          amountDinar: Number(e.amountDinar),
          expectedDinar: e.expectedDinar != null ? Number(e.expectedDinar) : null,
          matchesExpected: e.matchesExpected,
          mismatchReason: e.mismatchReason,
          mismatchNote: e.mismatchNote,
          recordedAt: e.createdAt.toISOString(),
          deletedAt: e.deletedAt?.toISOString() ?? null,
          deletedReason: e.deletedReason,
          deletedByDisplayName: e.deletedByDisplayName,
          performedByDisplayName:
            e.recordedByCompanyPreparer?.name?.trim() || e.courier?.name?.trim() || "—",
          recordedByCompanyPreparerId: e.recordedByCompanyPreparerId ?? null,
        }));

        // Test props mapping
        const shopsMapped = shops.map((s) => ({
          id: s.id,
          name: s.name,
          regionDeliveryPrice: dinarDecimalToAlfInputString(s.region?.deliveryPrice),
        }));

        const regionsMapped = regions.map((r) => ({
          id: r.id,
          name: r.name,
          deliveryPrice: dinarDecimalToAlfInputString(r.deliveryPrice),
        }));

        const couriersMapped = couriers.map((c) => ({ id: c.id, name: c.name }));

      } catch (err: any) {
        errorCount++;
        console.error(`\n❌ ERROR on Order #${orderShort.orderNumber} (ID: ${orderShort.id}):`);
        console.error(err.stack || err.message || err);
      }
    }

    console.log(`\nScan finished. Errors found: ${errorCount}`);
  } catch (err: any) {
    console.error("Global crash in diagnostic script:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
