import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChatView } from "@/components/coach/chat-view";
import type { ChatMsg } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // la réponse du coach (action serveur) peut prendre une dizaine de secondes
export const metadata = { title: "Coach" };

/** Chat avec le coach IA : la conversation la plus récente, prête à continuer. */
export default async function CoachPage() {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login");
  const chat = await prisma.coachChat.findFirst({
    where: { userId }, orderBy: { updatedAt: "desc" },
    select: { id: true, messages: { orderBy: { createdAt: "desc" }, take: 60, select: { id: true, role: true, content: true } } },
  });
  return <ChatView chatId={chat?.messages.length ? chat.id : null} initial={[...(chat?.messages ?? [])].reverse() as ChatMsg[]} configured={!!process.env.ANTHROPIC_API_KEY?.trim()} />;
}
