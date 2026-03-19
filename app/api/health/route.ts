import { NextResponse } from "next/server"

export async function GET() {
  try {
    const res = await fetch("http://localhost:4000/admin/stats", {
      cache: "no-store",
    })

    const text = await res.text()

    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to reach backend",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}