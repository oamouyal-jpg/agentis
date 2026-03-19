"use client";

import Link from "next/link";

export default function NavBar() {
  return (
    <nav
      style={{
        display: "flex",
        gap: "12px",
        padding: "16px 24px",
        borderBottom: "1px solid #ddd",
        marginBottom: "24px",
        background: "#fff",
      }}
    >
      <Link href="/" style={linkStyle}>
        Home
      </Link>
      <Link href="/submit" style={linkStyle}>
        Submit
      </Link>
      <Link href="/questions" style={linkStyle}>
        Questions
      </Link>
      <Link href="/admin" style={linkStyle}>
        Admin
      </Link>
    </nav>
  );
}

const linkStyle = {
  textDecoration: "none",
  color: "#2563eb",
  fontWeight: "bold",
};