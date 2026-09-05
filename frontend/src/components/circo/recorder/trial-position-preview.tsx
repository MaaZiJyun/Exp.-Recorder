import type { StimulationPosition, Trial } from "@/app/types";

export function TrialPositionPreview({
  trial,
  positions,
  showDetails = false,
}: {
  trial: Trial;
  positions: StimulationPosition[];
  showDetails?: boolean;
}) {
  const selectedPositions = [
    positions.find(
      (position) => position.position_id === trial.stimulation_position_id,
    ),
    positions.find(
      (position) => position.position_id === trial.stimulation_position_2_id,
    ),
  ].filter((position): position is StimulationPosition => Boolean(position));
  const map =
    selectedPositions.find((position) => position.image)?.image ?? null;

  if (!map) {
    return (
      <div className="trial-position-empty">
        <span>POSITION MAP</span>
        <small>该 Trial 没有可用的刺激位置图片</small>
      </div>
    );
  }

  return (
    <div className="trial-position-preview">
      <div className="trial-position-map">
        <img src={map} alt={`刺激位置 ${trial.stimulation_position}`} />
        {selectedPositions.map(
          (position) =>
            position.mark && (
              <span
                key={position.position_id}
                className="trial-position-marker"
                style={{
                  left: `${position.mark.x * 100}%`,
                  top: `${position.mark.y * 100}%`,
                }}
              >
                <i />
                <b>{position.code}</b>
              </span>
            ),
        )}
      </div>
      {showDetails && (
        <div className="trial-position-details">
          {selectedPositions.map((position) => (
            <div key={position.position_id}>
              <strong>{position.code}</strong>
              <p>{position.description || "暂无描述"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
