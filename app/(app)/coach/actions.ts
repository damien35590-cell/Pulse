"use server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dayKey } from "@/lib/dates";
import { endOfDay } from "@/lib/analysis/period";
import { CoachAiError } from "@/lib/coach/ai";
import { askCoachChat, chatContext, CHAT_HISTORY, CHAT_MAX_CHARS } from "@/lib/coach/chat";
import { trimToSentence } from "@/lib/coach/chat-render";

const TZ = "Europe/Paris";
/** Garde-fou de coût : questions au plus par jour. */
const DAILY_CAP = 15;

export type ChatMsg = { id: string; role: "user" | "assistant"; content: string };
export type SendResult = { ok: true; chatId: string; reply: ChatMsg; userMsg: ChatMsg } | { ok: false; error: string };

/** Pose une question au coach. Sans `chatId`, ouvre une nouvelle conversation. */
export async function sendCoachMessage(input: { chatId: string | null; text: string }): Promise<SendResult> {
  const userId = (await auth())?.user?.id;
  if (!userId) return { ok: false, error: "Session expirée : reconnecte-toi." };
  const text = input.text.trim().slice(0, CHAT_MAX_CHARS);
  if (!text) return { ok: false, error: "Écris ta question." };

  try {
    const dayStart = new Date(+endOfDay(dayKey(new Date(), TZ), TZ) - 864e5 + 1000);
    const asked = await prisma.coachMessage.count({ where: { role: "user", createdAt: { gte: dayStart }, chat: { userId } } });
    if (asked >= DAILY_CAP) return { ok: false, error: `Limite de ${DAILY_CAP} questions par jour atteinte : reviens demain.` };

    const chat = input.chatId ? await prisma.coachChat.findFirst({ where: { id: input.chatId, userId }, select: { id: true } }) : null;
    const chatId = chat?.id ?? (await prisma.coachChat.create({ data: { userId }, select: { id: true } })).id;
    const past = await prisma.coachMessage.findMany({ where: { chatId }, orderBy: { createdAt: "desc" }, take: CHAT_HISTORY - 1, select: { role: true, content: true } });
    const history = [...past.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content })), { role: "user" as const, content: text }];
    // L'API attend une conversation qui commence par l'utilisateur
    while (history.length && history[0].role !== "user") history.shift();

    const context = await chatContext(userId, TZ);
    const r = await askCoachChat(history, context);
    if (!r.text) throw new CoachAiError("Le coach n'a rien répondu, réessaie.");
    const answer = r.truncated ? trimToSentence(r.text) : r.text;

    const [userMsg, reply] = await prisma.$transaction([
      prisma.coachMessage.create({ data: { chatId, role: "user", content: text }, select: { id: true, role: true, content: true } }),
      prisma.coachMessage.create({ data: { chatId, role: "assistant", content: answer, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, cachedTokens: r.cachedTokens }, select: { id: true, role: true, content: true } }),
      prisma.coachChat.update({ where: { id: chatId }, data: { updatedAt: new Date() }, select: { id: true } }),
    ]);
    return { ok: true, chatId, userMsg: userMsg as ChatMsg, reply: reply as ChatMsg };
  } catch (e) {
    console.error("[coach-chat]", e);
    return { ok: false, error: e instanceof CoachAiError ? e.message : "Le coach est injoignable pour le moment, réessaie dans un instant." };
  }
}
