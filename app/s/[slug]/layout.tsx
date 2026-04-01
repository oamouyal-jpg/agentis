import { SpaceInviteCapture } from "./SpaceInviteCapture";

export default async function SpaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      <SpaceInviteCapture slug={slug} />
      {children}
    </>
  );
}
