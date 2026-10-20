import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { createWidget } from '../src/model/document';
import { createLineStyleRenderer } from '../src/model/line-style';
import { parseVectorPath } from '../src/model/vector';
import type { VectorPath, Widget } from '../src/model/types';

interface PillSource {
  sourceId: string;
  sample: string;
  size: { Width: number; Height: number };
  vectorPath: VectorPath;
  effective: Record<string, { value: number }>;
  observed: { vertexCounts: number[]; segmentValidator: number[] | null };
}
const inventory = JSON.parse(readFileSync('research/native-pills-format-inventory.json', 'utf8'));
const pills: PillSource[] = inventory.owners.filter((owner: PillSource) => owner.observed.vertexCounts.length === 1 && owner.observed.vertexCounts[0] === 6);
const makeWidget = (owner: PillSource): Widget => ({
  ...createWidget('box'), id: owner.sourceId, width: owner.size.Width, height: owner.size.Height,
  vectorPath: parseVectorPath(owner.vectorPath),
  style: { ...createWidget('box').style, radius: owner.effective['71'].value, cornerVisibility: [true, true, true, true] },
});

it('binds the 28 retained six-anchor Form pills rather than arbitrary six-anchor paths', () => {
  expect(pills).toHaveLength(28);
  expect(new Set(pills.map(owner => owner.sourceId)).size).toBe(28);
  expect(pills.every(owner => owner.sample === 'Sample form patterns.rplib' && owner.effective['81'].value === 15 && owner.observed.segmentValidator)).toBe(true);
});

for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} native pill recognition`, () => {
  const lines: ReturnType<typeof createLineStyleRenderer> = portable
    ? new Script(`(${createLineStyleRenderer.toString()})()`).runInNewContext()
    : createLineStyleRenderer();

  it.each(pills)('recognizes source $sourceId at its original and changed aspect ratios without changing saved geometry', owner => {
    const widget = makeWidget(owner), before = structuredClone(widget.vectorPath);
    expect(lines.rectangleRadii(widget.vectorPath!, widget.width, widget.height)).toEqual(owner.observed.segmentValidator);
    for (const [width, height] of [[widget.width, widget.height], [widget.width * 2.3, widget.height * .6], [widget.width * .5, widget.height * 3.1]]) {
      widget.width = width; widget.height = height;
      expect(lines.supportsCorners(widget)).toBe(true);
      expect(lines.supportsSides(widget)).toBe(true);
      expect(lines.vectorRectangle(widget)).toBeDefined();
      expect(widget.vectorPath).toEqual(before);
    }
  });

  it.each(pills)('rejects a real handle edit in source $sourceId rather than authorizing all six-anchor contours', owner => {
    const widget = makeWidget(owner), cubic = widget.vectorPath!.commands.find(command => command.op === 'C')!;
    if (cubic.op !== 'C') throw new Error('Expected a curved pill');
    cubic.x1 += .0001;
    expect(lines.supportsCorners(widget)).toBe(false);
    expect(lines.supportsSides(widget)).toBe(false);
    expect(lines.vectorRectangle(widget)).toBeUndefined();
  });

  it('keeps legacy no-mask, arbitrary-path, open and compound-contour boundaries', () => {
    const widget = makeWidget(pills[0]);
    delete widget.style.cornerVisibility;
    expect(lines.supportsCorners(widget)).toBe(false);
    expect(lines.vectorRectangle(widget)).toBeUndefined();
    const arbitrary = makeWidget(pills[0]); arbitrary.type = 'path';
    expect(lines.supportsCorners(arbitrary)).toBe(false);
    expect(lines.vectorRectangle(arbitrary)).toBeUndefined();
    const open = makeWidget(pills[0]); open.vectorPath!.commands.pop();
    expect(lines.supportsCorners(open)).toBe(false);
    const compound = makeWidget(pills[0]); compound.vectorPath!.commands.push(...structuredClone(compound.vectorPath!.commands));
    expect(lines.supportsCorners(compound)).toBe(false);
  });
});
