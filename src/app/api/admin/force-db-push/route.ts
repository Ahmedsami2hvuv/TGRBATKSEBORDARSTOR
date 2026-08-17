import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("token") !== "ahmed123") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Starting DB push from Vercel...");
    const result = execSync("npx prisma db push --accept-data-loss", { encoding: "utf-8" });
    
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("DB push failed:", error);
    return NextResponse.json({ success: false, error: error.message, stdout: error.stdout, stderr: error.stderr }, { status: 500 });
  }
}
