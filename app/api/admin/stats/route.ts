import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("http://localhost:4000/admin/stats", {
      method: "GET",
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || "Backend admin stats failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Admin stats route error:", error);

    return NextResponse.json(
      { error: "Could not connect to backend admin stats" },
      { status: 500 }
    );
  }
}