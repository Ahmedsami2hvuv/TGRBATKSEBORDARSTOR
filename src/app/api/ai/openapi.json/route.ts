import { NextResponse } from "next/server";

export async function GET() {
  const openApiSchema = {
    openapi: "3.0.0",
    info: {
      title: "أبو الأكبر للتوصيل - Gemini Official API Extension",
      version: "1.0.0",
      description: "نقطة الربط المباشرة والرسمية لتطبيق Google Gemini لإضافة ورصد الطلبات والتجهيز والديون"
    },
    servers: [
      {
        url: "https://aboakbr.com",
        description: "سيرفر الموقع المباشر"
      }
    ],
    paths: {
      "/api/ai/admin-voice": {
        post: {
          summary: "إضافة ورصد الطلبات والمعاملات عبر الذكاء الاصطناعي",
          operationId: "createAdminOrderOrTransaction",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    text: {
                      type: "string",
                      description: "أمر الطلب أو مسودة التجهيز أو تسجيل الديون بالنص الكامل"
                    }
                  },
                  required: ["text"]
                }
              }
            }
          },
          responses: {
            "200": {
              description: "تم تنفيذه وتثبيته بالنظام بنجاح",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      reply: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        },
        get: {
          summary: "إرسال أمر عبر رابط GET المباشر",
          operationId: "createAdminOrderViaGet",
          parameters: [
            {
              name: "text",
              in: "query",
              required: true,
              schema: { type: "string" },
              description: "نص الطلب أو المعاملة"
            }
          ],
          responses: {
            "200": {
              description: "تم تنفيذه بنجاح"
            }
          }
        }
      }
    }
  };

  return NextResponse.json(openApiSchema);
}
