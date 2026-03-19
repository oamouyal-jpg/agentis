import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("http://localhost:4000/questions", {
      method: "GET",
      cache: "no-store",
    });

    const text = await res.text();

    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: "Backend questions fetch failed", details: data },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Questions route error:", error);
    return NextResponse.json(
      { error: "Could not connect to backend" },
      { status: 500 }
    );
  }
}