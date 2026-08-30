import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// نستخدم الاستيراد الديناميكي لتجنب مشاكل Turbopack أثناء الـ Build
async function getS3Client() {
  if (typeof window !== 'undefined') return null;
  const { S3Client } = await import("@aws-sdk/client-s3");

  if (process.env.R2_ACCESS_KEY_ID && process.env.R2_ENDPOINT) {
    return new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ضمان عدم محاولة معالجة المسار أثناء البناء

function normalizeIncomingKey(originalKey: string): string {
  let key = (originalKey || "").trim().replace(/^\/+/, "");
  if (!key) return "";

  try {
    key = decodeURIComponent(key);
  } catch {
    // ignore invalid encoding
  }

  const lowered = key.toLowerCase();
  const uploadsAt = lowered.indexOf("/uploads/");
  if (uploadsAt >= 0) {
    key = key.slice(uploadsAt + "/uploads/".length);
  } else if (lowered.startsWith("uploads/")) {
    key = key.slice("uploads/".length);
  }

  return key.replace(/^\/+/, "");
}

function buildCandidateKeys(originalKey: string): string[] {
  const key = normalizeIncomingKey(originalKey);
  if (!key) return [];

  const out = new Set<string>([key]);
  const lower = key.toLowerCase();

  const extMap: Record<string, string[]> = {
    ".jpeg": [".jpg", ".png", ".webp"],
    ".jpg": [".jpeg", ".png", ".webp"],
    ".png": [".jpg", ".jpeg", ".webp"],
    ".webp": [".jpg", ".jpeg", ".png"],
  };

  const matchedExt = Object.keys(extMap).find((ext) => lower.endsWith(ext));
  if (matchedExt) {
    const base = key.slice(0, key.length - matchedExt.length);
    for (const alt of extMap[matchedExt]) {
      out.add(`${base}${alt}`);
    }
  }

  const slash = key.lastIndexOf("/");
  const fileName = slash >= 0 ? key.slice(slash + 1) : key;
  if (fileName) {
    const folders = ["products", "market", "customers", "profiles", "orders", "customer-photos", "door-photos"];
    for (const folder of folders) {
      out.add(`${folder}/${fileName}`);
    }
  }

  return [...out];
}

/**
 * فحص ما إذا كان الطلب قادماً من روبوتات وتطبيقات التواصل الاجتماعي
 */
function isSocialCrawlerOrBrowser(userAgent: string, acceptHeader: string, secFetchDest: string): boolean {
  const ua = (userAgent || "").toLowerCase();
  const accept = (acceptHeader || "").toLowerCase();

  // برامج الروبوت التابعة لتطبيقات المحادثة ومواقع التواصل
  const crawlers = [
    "whatsapp",
    "telegrambot",
    "facebookexternalhit",
    "facebot",
    "twitterbot",
    "slackbot",
    "linkedinbot",
    "discordbot",
    "viber",
    "skypeuripreview",
    "bingbot",
    "googlebot",
    "applebot",
    "pinterest",
  ];

  if (crawlers.some((c) => ua.includes(c))) {
    return true;
  }

  // إذا طلب المتصفح الصفحة كـ HTML وليس كوسم <img> مباشر
  if (accept.includes("text/html") && secFetchDest !== "image") {
    return true;
  }

  return false;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  try {
    const { path: segments } = await context.params;
    const rawPath = segments?.join("/") || "";
    const userAgent = req.headers.get("user-agent") || "";
    const acceptHeader = req.headers.get("accept") || "";
    const secFetchDest = req.headers.get("sec-fetch-dest") || "";

    // 1. إذا كان الطلب من تطبيق تواصل لعرض المعاينة الغنية (Open Graph Preview)
    if (isSocialCrawlerOrBrowser(userAgent, acceptHeader, secFetchDest)) {
      try {
        // نبحث عن المنتج أو الفرع أو القسم المرتبط بهذه الصورة
        const fileName = segments && segments.length > 0 ? segments[segments.length - 1] : "";
        const candidateKeys = buildCandidateKeys(rawPath);

        let product: any = null;
        let branch: any = null;
        let category: any = null;

        if (fileName) {
          // نبحث في جدول المنتجات
          product = await prisma.storeProduct.findFirst({
            where: {
              OR: [
                { photoUrls: { has: `/uploads/${rawPath}` } },
                { photoUrls: { has: `https://aboakbr.com/uploads/${rawPath}` } },
                { photoUrls: { hasSome: Array.from(candidateKeys).map(k => `/uploads/${k}`) } },
              ]
            },
            include: {
              branch: {
                include: { category: true }
              }
            }
          });

          // إذا لم نجده بالمسار الدقيق، نبحث بالاسم الفرعي
          if (!product) {
            const allProductsWithPhotos = await prisma.storeProduct.findMany({
              where: { active: true },
              select: { id: true, name: true, description: true, salePrice: true, photoUrls: true, branch: { select: { id: true, name: true, categoryId: true, category: { select: { id: true, name: true } } } } },
              take: 200,
            });
            product = allProductsWithPhotos.find(p => p.photoUrls?.some(u => u.includes(fileName)));
          }

          // إذا لم يكن منتجاً، نبحث هل هي صورة فرع
          if (!product) {
            branch = await prisma.storeBranch.findFirst({
              where: {
                photoUrl: { contains: fileName }
              },
              include: { category: true }
            });
          }

          // إذا لم تكن صورة فرع، نبحث هل هي صورة قسم
          if (!product && !branch) {
            category = await prisma.storeCategory.findFirst({
              where: {
                photoUrl: { contains: fileName }
              }
            });
          }
        }

        const absoluteImageUrl = `https://aboakbr.com/uploads/${rawPath}`;

        if (product) {
          const title = `${product.name} | ${product.branch?.name ? product.branch.name + " - " : ""}${product.branch?.category?.name ? product.branch.category.name + " | " : ""}خصيب ستور`;
          const description = product.description?.trim() 
            ? product.description 
            : `تسوق ${product.name} من خصيب ستور — متجر أبو الأكبر للتوصيل. اطلب الآن واستلم فوري لباب بيتك!`;
          const targetUrl = product.branch?.categoryId 
            ? `https://aboakbr.com/store/c/${product.branch.categoryId}?b=${product.branchId}&product=${product.id}`
            : `https://aboakbr.com/store/product/${product.id}`;

          const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <!-- Open Graph / Facebook / WhatsApp / Telegram -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${targetUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${absoluteImageUrl}">
  <meta property="og:image:secure_url" content="${absoluteImageUrl}">
  <meta property="og:image:width" content="800">
  <meta property="og:image:height" content="800">
  <meta property="og:site_name" content="خصيب ستور — أبو الأكبر للتوصيل">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${targetUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${absoluteImageUrl}">

  <script>
    // إذا فتح شخص عادي الرابط من المتصفح، نوجهه فوراً لصفحة المنتج
    window.location.replace("${targetUrl}");
  </script>
</head>
<body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; text-align: center; direction: rtl;">
  <div style="background: white; padding: 2rem; border-radius: 1.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.05); max-width: 400px;">
    <img src="${absoluteImageUrl}" alt="${product.name}" style="width: 100%; height: 250px; object-fit: cover; border-radius: 1rem; margin-bottom: 1rem;">
    <h2 style="color: #0f172a; margin: 0 0 0.5rem 0;">${product.name}</h2>
    <p style="color: #64748b; font-size: 14px; margin-bottom: 1.5rem;">${description}</p>
    <a href="${targetUrl}" style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: bold;">فتح في المتجر 🛒</a>
  </div>
</body>
</html>`;

          return new NextResponse(html, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            },
          });
        }

        if (branch) {
          const title = `فرع ${branch.name} — ${branch.category?.name || "المتجر"} | خصيب ستور`;
          const description = `تصفح منتجات ${branch.name} في ${branch.category?.name || "خصيب ستور"} — متجر أبو الأكبر للتوصيل.`;
          const targetUrl = branch.categoryId ? `https://aboakbr.com/store/c/${branch.categoryId}?b=${branch.id}` : `https://aboakbr.com/store/b/${branch.id}`;

          const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <meta property="og:type" content="website">
  <meta property="og:url" content="${targetUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${absoluteImageUrl}">
  <meta property="og:image:width" content="800">
  <meta property="og:image:height" content="800">
  <meta property="og:site_name" content="خصيب ستور — أبو الأكبر للتوصيل">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${absoluteImageUrl}">

  <script>
    window.location.replace("${targetUrl}");
  </script>
</head>
<body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; text-align: center; direction: rtl;">
  <div style="background: white; padding: 2rem; border-radius: 1.5rem; max-width: 400px;">
    <img src="${absoluteImageUrl}" alt="${branch.name}" style="width: 100%; height: 250px; object-fit: cover; border-radius: 1rem; margin-bottom: 1rem;">
    <h2 style="color: #0f172a;">${branch.name}</h2>
    <a href="${targetUrl}" style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: bold;">تصفح الفرع 🛒</a>
  </div>
</body>
</html>`;

          return new NextResponse(html, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=3600",
            },
          });
        }

        if (category) {
          const title = `قسم ${category.name} | خصيب ستور — أبو الأكبر للتوصيل`;
          const description = `تصفح جميع فروع ومنتجات قسم ${category.name} في متجر أبو الأكبر للتوصيل.`;
          const targetUrl = `https://aboakbr.com/store/c/${category.id}`;

          const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <meta property="og:type" content="website">
  <meta property="og:url" content="${targetUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${absoluteImageUrl}">
  <meta property="og:image:width" content="800">
  <meta property="og:image:height" content="800">
  <meta property="og:site_name" content="خصيب ستور — أبو الأكبر للتوصيل">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${absoluteImageUrl}">

  <script>
    window.location.replace("${targetUrl}");
  </script>
</head>
<body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; text-align: center; direction: rtl;">
  <div style="background: white; padding: 2rem; border-radius: 1.5rem; max-width: 400px;">
    <img src="${absoluteImageUrl}" alt="${category.name}" style="width: 100%; height: 250px; object-fit: cover; border-radius: 1rem; margin-bottom: 1rem;">
    <h2 style="color: #0f172a;">${category.name}</h2>
    <a href="${targetUrl}" style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: bold;">تصفح القسم 🛒</a>
  </div>
</body>
</html>`;

          return new NextResponse(html, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
      } catch (err) {
        console.error("Error generating social preview HTML for upload:", err);
      }
    }

    // 2. إذا كان الطلب طلباً مباشراً لملف الصورة الخام (Binary Image)
    const r2Client = await getS3Client();

    if (!segments?.length || !r2Client) {
      console.error("R2 Config Missing or Path Empty");
      return new NextResponse("Not found", { status: 404 });
    }

    const key = segments.join("/");
    const candidateKeys = buildCandidateKeys(key);

    let foundCandidate: string | null = null;
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");

    for (const candidate of candidateKeys) {
      try {
        await r2Client.send(
          new HeadObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: candidate,
          }),
        );
        foundCandidate = candidate;
        break;
      } catch {
        // continue to next candidate
      }
    }

    if (!foundCandidate) {
      return new NextResponse("File Not Found", { status: 404 });
    }

    // جلب الملف مباشرة من R2 كـ Buffer وإرجاعه للمتصفح لتفادي مشاكل الـ 401 مع الروابط العامة لـ R2
    try {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const res = await r2Client.send(new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: foundCandidate,
      }));

      if (!res.Body) {
        return new NextResponse("File Empty", { status: 404 });
      }

      const fileBytes = await res.Body.transformToByteArray();
      const fileBuffer = Buffer.from(fileBytes);
      const contentType = res.ContentType || "image/jpeg";

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (s3Err) {
      console.error("Failed to stream file from R2 directly, trying fallback redirect:", s3Err);
      const r2Domain = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_BUCKET_DOMAIN || "https://pub-2f7b4947937d4575971a8f949826a575.r2.dev";
      const cleanDomain = r2Domain.replace(/\/$/, "");
      return NextResponse.redirect(`${cleanDomain}/${foundCandidate}`, 307);
    }
  } catch (error) {
    console.error("Error fetching or redirecting file from R2:", error);
    return new NextResponse("Image Not Found", { status: 404 });
  }
}
