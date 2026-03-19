import { NextResponse } from "next/server";

export async function POST() {
  try {
    const res = await fetch("http://localhost:4000/admin/cluster", {
      method: "POST",
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || "Backend admin cluster failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Admin cluster route error:", error);

    return NextResponse.json(
      { error: "Could not connect to backend admin cluster" },
      { status: 500 }
    );
  }
}