"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import { Badge, Button, Dialog, EmptyState, Field, Input, Select, Textarea } from "@/components/circo/ui";
import type { RecorderContext } from "@/app/use-recorder";

export function PositionMapPanel({ ctx }: { ctx: RecorderContext }) {
  const { activePositionImage, positions } = ctx;

  return (
    <section className="panel p-4">
      <div className="section-heading">
        <h2>Shared Position Map</h2>
      </div>
      {activePositionImage?.image ? (
        <div className="grid gap-3">
          <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
            <img
              src={activePositionImage.image}
              alt="Shared stimulation position map"
              className="block h-auto w-full"
            />
            {positions
              .filter(
                (position) =>
                  position.image_id === activePositionImage.image_id &&
                  position.mark,
              )
              .map((position) => (
                <span
                  key={position.position_id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${(position.mark?.x ?? 0) * 100}%`,
                    top: `${(position.mark?.y ?? 0) * 100}%`,
                  }}
                >
                  <i className="block size-4 rounded-full border-2 border-white bg-red-500 shadow" />
                  <b className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded bg-zinc-950 px-1.5 py-1 text-[10px] leading-none text-white shadow">
                    {position.code}
                  </b>
                </span>
              ))}
          </div>
          <small className="text-zinc-500">
            同一图片上的所有 Position marks 会同时显示。
          </small>
        </div>
      ) : (
        <EmptyState
          title="还没有位置图片"
          description="新建 Position 并上传图片后，会在这里显示所有标记。"
        />
      )}
    </section>
  );
}

export function PositionCardsPanel({ ctx }: { ctx: RecorderContext }) {
  const {
    positions,
    visiblePositions,
    running,
    positionDeleting,
    activePositionImage,
    speciesRecords,
    speciesImageOptions,
    editingPosition,
    positionEditorId,
    positionDraft,
    positionSaving,
    setSelectedPositionImageId,
    newPosition,
    editPosition,
    deletePosition,
    setPositionDraft,
    setEditingPosition,
    readPositionImage,
    savePosition,
  } = ctx;

  return (
    <>
      <section className="panel history-panel subject-records-panel">
        <div className="history-header">
          <div className="section-heading">
            <h2>Stimulation Positions</h2>
          </div>
          <Button className="min-h-9 px-3 text-xs" onClick={newPosition}>
            <PlusIcon className="size-4" />
            新建 Position
          </Button>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {visiblePositions.map((position) => (
            <article
              key={position.position_id}
              className={`cursor-pointer overflow-hidden rounded-xl border bg-white ${activePositionImage?.image_id === position.image_id ? "border-zinc-950 ring-2 ring-zinc-200" : "border-zinc-200"}`}
              onClick={() => setSelectedPositionImageId(position.image_id)}
            >
              {position.image ? (
                <div className="flex h-48 items-center justify-center bg-zinc-100">
                  <div className="relative w-fit max-w-full">
                    <img
                      src={position.image}
                      alt={`Stimulation position ${position.code}`}
                      className="block max-h-48 max-w-full"
                    />
                    {position.mark && (
                      <span
                        className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow"
                        style={{
                          left: `${position.mark.x * 100}%`,
                          top: `${position.mark.y * 100}%`,
                        }}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid h-48 place-items-center bg-zinc-100 text-sm text-zinc-400">
                  No image
                </div>
              )}
              <div className="grid gap-3 p-4">
                <div>
                  <Badge tone="info">{position.code}</Badge>
                  <p className="mt-2 text-sm text-zinc-600">
                    {position.description || "No description"}
                  </p>
                </div>
                <small className="text-zinc-500">
                  ID {position.position_id} · {position.trial_count} trials
                </small>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => editPosition(position)}
                    disabled={running}
                  >
                    编辑
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => void deletePosition(position)}
                    disabled={
                      running ||
                      position.trial_count > 0 ||
                      positionDeleting === position.position_id
                    }
                  >
                    {positionDeleting === position.position_id ? "…" : "删除"}
                  </Button>
                </div>
                {position.trial_count > 0 && (
                  <small className="text-zinc-500">
                    已被 Trial 使用，不能删除。
                  </small>
                )}
              </div>
            </article>
          ))}
          {visiblePositions.length === 0 && (
            <EmptyState
              title={
                positions.length === 0
                  ? "还没有 Position"
                  : "没有匹配的 Position"
              }
              description="创建并标记刺激位置后，才能开始实验。"
            />
          )}
        </div>
      </section>

      <Dialog
        open={editingPosition}
        title={positionEditorId === null ? "New Position" : "Edit Position"}
        closeLabel="关闭"
        onClose={() => setEditingPosition(false)}
      >
        <div className="grid gap-5">
          <Field
            label="CODE"
            hint="例如 A1；只能使用字母、数字、下划线和连字符。"
          >
            <Input
              value={positionDraft.code}
              onChange={(event) =>
                setPositionDraft((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
              placeholder="A1"
              autoFocus
            />
          </Field>
          <Field label="DESCRIPTION">
            <Textarea
              value={positionDraft.description}
              onChange={(event) =>
                setPositionDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="位置说明、解剖标记或操作备注…"
            />
          </Field>
          <Field
            label="SPECIES"
            hint="该位置及照片仅用于对应物种；留空表示通用。"
          >
            <Select
              value={positionDraft.species}
              onChange={(event) =>
                setPositionDraft((current) => ({
                  ...current,
                  species: event.target.value,
                  image:
                    speciesRecords.find(
                      (species) => species.code === event.target.value,
                    )?.image ?? "",
                  mark: null,
                }))
              }
            >
              <option value="">通用位置</option>
              {speciesRecords.map((species) => (
                <option key={species.species_id} value={species.code}>
                  {species.code} · {species.scientific_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="IMAGE"
            hint="图片由所选 Species 自动提供。"
            className="hidden"
          >
            {speciesImageOptions.length > 0 && (
              <Select
                value={
                  speciesImageOptions
                    .find((species) => species.image === positionDraft.image)
                    ?.species_id?.toString() ?? ""
                }
                onChange={(event) => {
                  const selectedImage = speciesImageOptions.find(
                    (species) =>
                      String(species.species_id) === event.target.value,
                  );
                  setPositionDraft((current) => ({
                    ...current,
                    image: selectedImage?.image ?? "",
                    mark: null,
                  }));
                }}
              >
                <option value="">选择物种图片…</option>
                {speciesImageOptions.map((species) => (
                  <option key={species.species_id} value={species.species_id}>
                    {species.code} · {species.scientific_name}
                  </option>
                ))}
              </Select>
            )}
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => readPositionImage(event.target.files?.[0])}
            />
          </Field>
          {positionDraft.image && (
            <div className="grid gap-3">
              <p className="text-xs text-zinc-500">点击图片设置 mark。</p>
              <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-xl border border-zinc-200">
                <img
                  src={positionDraft.image}
                  alt="Position preview"
                  className="block max-h-64 max-w-full cursor-crosshair"
                  onClick={(event) => {
                    const bounds = event.currentTarget.getBoundingClientRect();
                    setPositionDraft((current) => ({
                      ...current,
                      mark: {
                        x: (event.clientX - bounds.left) / bounds.width,
                        y: (event.clientY - bounds.top) / bounds.height,
                      },
                    }));
                  }}
                />
                {positionDraft.mark && (
                  <span
                    className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow"
                    style={{
                      left: `${positionDraft.mark.x * 100}%`,
                      top: `${positionDraft.mark.y * 100}%`,
                    }}
                  />
                )}
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  setPositionDraft((current) => ({
                    ...current,
                    image: "",
                    mark: null,
                  }))
                }
              >
                移除图片
              </Button>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setEditingPosition(false)}
            >
              取消
            </Button>
            <Button
              onClick={() => void savePosition()}
              disabled={positionSaving}
            >
              {positionSaving ? "保存中…" : "保存 Position"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
