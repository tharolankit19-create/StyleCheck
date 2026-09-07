import type { ExerciseConfig } from "@/lib/types";

export const EXERCISES: Record<string, ExerciseConfig> = {
  pushup: {
    type: "pushup",
    displayName: "Push-ups",
    description:
      "Lower your body until your elbows reach ~90°, then press back up. Keep your body straight.",
    emoji: "💪",
  },
  squat: {
    type: "squat",
    displayName: "Squats",
    description:
      "Bend your knees until your thighs are roughly parallel to the floor, then stand back up.",
    emoji: "🦵",
  },
};

export function listExercises(): ExerciseConfig[] {
  return Object.values(EXERCISES);
}