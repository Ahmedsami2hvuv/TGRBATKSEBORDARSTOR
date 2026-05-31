import { prisma } from "./src/lib/prisma";
import { dinarDecimalToAlfInputString } from "./src/lib/money-alf";
import { courierAssignableWhere } from "./src/lib/courier-assignable";
import { normalizeIraqMobileLocal11 } from "./src/lib/whatsapp";

async function run() {
  const orderId = "cmp9y2pk30002ju0bt1e8rfdw";
  console.log(`Starting diagnostic scan for Order ID: ${orderId}...`);
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
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

    if (!order) {
      console.error(`❌ Order with ID ${orderId} not found in database!`);
      return;
    }

    console.log(`Successfully fetched Order #${order.orderNumber}. Simulating page load...`);

    const customerPhoneNorm = normalizeIraqMobileLocal11(order.customerPhone);
    console.log(`- customerPhoneNorm: ${customerPhoneNorm}`);
    console.log(`- customerRegionId: ${order.customerRegionId}`);

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

    console.log(`- customerPhoneProfile fetched: ${customerPhoneProfile ? "found" : "not found"}`);

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
    console.log(`- defaultCustomerDoorPhotoUrlEffective: ${defaultCustomerDoorPhotoUrlEffective}`);

    const courierWhere = {
      OR: [
        courierAssignableWhere,
        ...(order.assignedCourierId ? [{ id: order.assignedCourierId }] : []),
      ],
    };

    console.log("Fetching supporting data (shops, regions, couriers, employeesAll)...");
    const [shops, regions, couriers, employeesAll] = await Promise.all([
      prisma.shop.findMany({
        orderBy: { name: "asc" },
        include: { region: true },
      }),
      prisma.region.findMany({ orderBy: { name: "asc" } }),
      prisma.courier.findMany({ where: courierWhere, orderBy: { name: "asc" } }),
      prisma.employee.findMany({
        select: { id: true, shopId: true, name: true },
        orderBy: [{ shopId: "asc" }, { name: "asc" }],
      }),
    ]);
    console.log(`- Mapped shops: ${shops.length}, regions: ${regions.length}, couriers: ${couriers.length}, employees: ${employeesAll.length}`);

    const defaultSubmittedByEmployeeId =
      order.submittedByEmployeeId &&
      employeesAll.some(
        (e) => e.id === order.submittedByEmployeeId && e.shopId === order.shopId,
      )
        ? order.submittedByEmployeeId
        : "";
    console.log(`- defaultSubmittedByEmployeeId: "${defaultSubmittedByEmployeeId}"`);

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
    console.log(`- adminMoneyEvents count: ${adminMoneyEvents.length}`);

    const shopsMapped = shops.map((s) => ({
      id: s.id,
      name: s.name,
      regionDeliveryPrice: dinarDecimalToAlfInputString(s.region?.deliveryPrice),
    }));
    console.log("- shopsMapped succeeded");

    const regionsMapped = regions.map((r) => ({
      id: r.id,
      name: r.name,
      deliveryPrice: dinarDecimalToAlfInputString(r.deliveryPrice),
    }));
    console.log("- regionsMapped succeeded");

    const couriersMapped = couriers.map((c) => ({ id: c.id, name: c.name }));
    console.log("- couriersMapped succeeded");

    console.log("🎉 SUCCESS! No error during simulation!");
  } catch (err: any) {
    console.error(`\n❌ ERROR:`);
    console.error(err.stack || err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
