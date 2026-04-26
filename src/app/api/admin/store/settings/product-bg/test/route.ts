import { NextResponse } from "next/server";

export async function POST() {
    return NextResponse.json({ error: "Feature disabled" }, { status: 403 });
}
