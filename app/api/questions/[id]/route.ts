import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const backendResponse = await fetch(`http://localhost:4000/questions/${id}`, {
      method: "GET",
      cache: "no-store",
    });

    const data = await backendResponse.json();

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: data.error || "Backend question fetch failed" },
        { status: backendResponse.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Question detail route error:", error);

    return NextResponse.json(
      { error: "Could not connect to backend" },
      { status: 500 }
    );
  }
}