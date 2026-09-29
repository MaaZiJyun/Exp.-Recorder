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
      <div className="grid min-h-44 place-content-center gap-2 text-center text-zinc-500">
        <span className="text-[10px] font-semibold tracking-wider">POSITION MAP</span>
        <small className="text-[10px]">No stimulation-position image is available for this trial</small>
      </div>
    );
  }

  return (
    <div className="grid w-full min-w-0 place-items-center">
      <div className="relative w-full max-w-full">
        <img className="block h-auto w-full" src={map} alt={`Stimulation position ${trial.stimulation_position}`} />
        {selectedPositions.map(
          (position) =>
            position.mark && (
              <span
                key={position.position_id}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${position.mark.x * 100}%`,
                  top: `${position.mark.y * 100}%`,
                }}
              >
                <i className="block size-4 rounded-full border-2 border-white bg-red-500 shadow" />
                <b className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-950 px-1.5 py-1 font-mono text-[10px] leading-none text-white shadow">{position.code}</b>
              </span>
            ),
        )}
      </div>
      {showDetails && (
        <div className="mt-3 grid w-full gap-2">
          {selectedPositions.map((position) => (
            <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2" key={position.position_id}>
              <strong className="font-mono text-xs text-zinc-950">{position.code}</strong>
              <p className="m-0 text-xs leading-5 text-zinc-500">{position.description || "No description"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
