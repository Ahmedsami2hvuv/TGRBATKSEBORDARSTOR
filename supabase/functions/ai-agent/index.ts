import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve((request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  return Response.json(
    {
      done: false,
      message: "هذا المسار القديم متوقف. استخدم وكيل الإدارة المحمي داخل التطبيق.",
    },
    { status: 410 },
  );
});
