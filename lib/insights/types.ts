export type Act = {
  id: string; type: string; startedAt: Date; distanceM: number; movingTimeS: number; elevationGainM: number;
  startLat?: number | null; startLng?: number | null; weather?: { tempC?: number | null; precipMm?: number | null } | null;
};
export type Insight = { id: string; tone: "wow" | "progress" | "fun" | "streak"; icon: "mountain" | "trend" | "clock" | "flame" | "zap"; title: string; body: string };
export type Story = { tag: string; text: string };
