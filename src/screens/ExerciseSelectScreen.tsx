import { Link } from "react-router-dom";
import { listExercises } from "@/exercises/registry";
import { useStore } from "@/state/store";

export function ExerciseSelectScreen() {
  const setPreferred = useStore((s) => s.setPreferredExercise);
  const preferred = useStore((s) => s.settings.preferredExercise);

  return (
    <div className="page">
      <div className="card">
        <h2>Earn screen time</h2>
        <p className="sub">
          Pick an exercise. We'll open the camera and count verified reps
          locally — nothing leaves your device.
        </p>
      </div>
      <div className="list">
        {listExercises().map((ex) => (
          <Link
            key={ex.type}
            to={`/earn/${ex.type}`}
            className="row"
            onClick={() => setPreferred(ex.type)}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: "2rem" }}>{ex.emoji}</div>
              <div>
                <div className="title">{ex.displayName}</div>
                <div className="sub">{ex.description}</div>
              </div>
            </div>
            <span
              className={`tag ${
                preferred === ex.type ? "success" : "warn"
              }`}
            >
              {preferred === ex.type ? "preferred" : "tap to start"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}