#!/usr/bin/env node
"use strict";

// Read-only GLB 2.0 metadata inspection. No dependencies, network or writes.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function inspectGlb(bytes, filename = "model.glb") {
  if (!Buffer.isBuffer(bytes)) throw new TypeError("Expected a Buffer");
  if (bytes.length < 20) throw new Error("Truncated GLB header or first chunk");
  const magic = bytes.readUInt32LE(0);
  const version = bytes.readUInt32LE(4);
  const declaredLength = bytes.readUInt32LE(8);
  if (magic !== 0x46546c67) throw new Error("Invalid GLB magic");
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}`);
  if (declaredLength !== bytes.length) throw new Error("GLB declared length does not match file bytes");

  const chunks = [];
  let cursor = 12;
  while (cursor < bytes.length) {
    if (cursor + 8 > bytes.length) throw new Error("Truncated chunk header");
    const length = bytes.readUInt32LE(cursor);
    const type = bytes.readUInt32LE(cursor + 4);
    const offset = cursor + 8;
    if (length % 4 !== 0) throw new Error("Chunk length is not aligned to 4 bytes");
    if (offset + length > bytes.length) throw new Error("Chunk extends beyond GLB file");
    chunks.push({ type, name: type === 0x4e4f534a ? "JSON" : type === 0x004e4942 ? "BIN" : `0x${type.toString(16)}`, bytes: length, offset });
    cursor = offset + length;
  }
  if (chunks[0]?.name !== "JSON") throw new Error("First GLB chunk must be JSON");
  if (chunks.filter(chunk => chunk.name === "JSON").length !== 1) throw new Error("Expected exactly one JSON chunk");
  const binChunks = chunks.filter(chunk => chunk.name === "BIN");
  if (binChunks.length > 1) throw new Error("Expected at most one BIN chunk");
  const jsonChunk = chunks[0];
  const document = JSON.parse(bytes.subarray(jsonChunk.offset, jsonChunk.offset + jsonChunk.bytes).toString("utf8").trimEnd());
  if (document.asset?.version !== "2.0") throw new Error("glTF asset.version must be 2.0");

  const warnings = [];
  const accessors = document.accessors ?? [];
  const buffers = document.buffers ?? [];
  const bufferViews = document.bufferViews ?? [];
  for (const [index, buffer] of buffers.entries()) {
    if (!buffer.uri && (index !== 0 || !binChunks[0])) throw new Error(`Buffer ${index} lacks both URI and the GLB BIN chunk`);
    if (!buffer.uri && (buffer.byteLength > binChunks[0].bytes || buffer.byteLength < binChunks[0].bytes - 3)) throw new Error(`Buffer ${index} byteLength differs from its BIN chunk beyond allowed padding`);
  }
  for (const [index, view] of bufferViews.entries()) {
    const buffer = buffers[view.buffer];
    if (!buffer) throw new Error(`bufferView ${index} references an absent buffer`);
    if ((view.byteOffset ?? 0) < 0 || view.byteLength < 0 || (view.byteOffset ?? 0) + view.byteLength > buffer.byteLength) throw new Error(`bufferView ${index} exceeds its buffer`);
  }

  const uriReferences = [];
  function visit(value, keyPath = "$", key = "") {
    if (key === "uri" && typeof value === "string") {
      const embedded = value.startsWith("data:");
      uriReferences.push({ path: keyPath, embedded, uri: embedded ? value.slice(0, value.indexOf(",") + 1) : value });
    } else if (Array.isArray(value)) value.forEach((entry, index) => visit(entry, `${keyPath}[${index}]`));
    else if (value && typeof value === "object") Object.entries(value).forEach(([entryKey, entry]) => visit(entry, `${keyPath}.${entryKey}`, entryKey));
  }
  visit(document);

  const positionAccessors = new Set();
  const meshDetails = (document.meshes ?? []).map((mesh, meshIndex) => {
    let vertices = 0;
    let triangles = 0;
    const primitives = (mesh.primitives ?? []).map((primitive, primitiveIndex) => {
      const positionIndex = primitive.attributes?.POSITION;
      const position = accessors[positionIndex];
      if (!position || !Number.isInteger(position.count)) throw new Error(`Mesh ${meshIndex} primitive ${primitiveIndex} lacks a valid POSITION accessor`);
      positionAccessors.add(positionIndex);
      vertices += position.count;
      const indexed = primitive.indices !== undefined;
      const indexAccessor = indexed ? accessors[primitive.indices] : null;
      if (indexed && (!indexAccessor || !Number.isInteger(indexAccessor.count))) throw new Error(`Mesh ${meshIndex} primitive ${primitiveIndex} lacks a valid index accessor`);
      const elementCount = indexed ? indexAccessor.count : position.count;
      const mode = primitive.mode ?? 4;
      const primitiveTriangles = mode === 4 ? Math.floor(elementCount / 3) : mode === 5 || mode === 6 ? Math.max(0, elementCount - 2) : 0;
      if (mode === 4 && elementCount % 3) warnings.push(`Mesh ${meshIndex} primitive ${primitiveIndex} triangle element count is not divisible by 3`);
      if (mode !== 4) warnings.push(`Mesh ${meshIndex} primitive ${primitiveIndex} uses draw mode ${mode}`);
      triangles += primitiveTriangles;
      return { mode, indexed, vertices: position.count, elements: elementCount, triangles: primitiveTriangles, material: primitive.material ?? null, attributes: Object.keys(primitive.attributes ?? {}), morphTargets: primitive.targets?.length ?? 0, positionBounds: { min: position.min ?? null, max: position.max ?? null } };
    });
    return { index: meshIndex, name: mesh.name ?? null, vertices, triangles, primitives };
  });
  const meshByIndex = new Map(meshDetails.map(mesh => [mesh.index, mesh]));
  let instantiatedTrianglesAllNodes = 0;
  for (const node of document.nodes ?? []) if (node.mesh !== undefined) {
    if (!meshByIndex.has(node.mesh)) throw new Error("Node references an absent mesh");
    instantiatedTrianglesAllNodes += meshByIndex.get(node.mesh).triangles;
  }
  const externalUriReferences = uriReferences.filter(reference => !reference.embedded);
  if (externalUriReferences.length) warnings.push("File contains external URI references and is not fully self-contained");
  if (!(document.scenes?.length)) warnings.push("No scene is declared");
  if (!meshDetails.length) warnings.push("No mesh is declared");

  return {
    kind: "TRAINORACLE_GLB_METADATA_INSPECTION",
    inspectorVersion: 1,
    file: path.basename(filename),
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    header: { magic: "glTF", version, declaredLength },
    chunks,
    asset: document.asset,
    defaultScene: document.scene ?? null,
    counts: {
      scenes: document.scenes?.length ?? 0,
      nodes: document.nodes?.length ?? 0,
      meshes: meshDetails.length,
      primitives: meshDetails.reduce((sum, mesh) => sum + mesh.primitives.length, 0),
      verticesSummedPerPrimitive: meshDetails.reduce((sum, mesh) => sum + mesh.vertices, 0),
      verticesUniquePositionAccessors: [...positionAccessors].reduce((sum, index) => sum + accessors[index].count, 0),
      trianglesSummedPerMesh: meshDetails.reduce((sum, mesh) => sum + mesh.triangles, 0),
      instantiatedTrianglesAllNodes,
      materials: document.materials?.length ?? 0,
      textures: document.textures?.length ?? 0,
      images: document.images?.length ?? 0,
      skins: document.skins?.length ?? 0,
      jointsSummedPerSkin: (document.skins ?? []).reduce((sum, skin) => sum + (skin.joints?.length ?? 0), 0),
      animations: document.animations?.length ?? 0,
    },
    images: (document.images ?? []).map((image, index) => ({ index, mimeType: image.mimeType ?? null, bufferView: image.bufferView ?? null, hasUri: typeof image.uri === "string" })),
    animations: (document.animations ?? []).map((animation, index) => ({ index, name: animation.name ?? null, channels: animation.channels?.length ?? 0, samplers: animation.samplers?.length ?? 0 })),
    extensionsUsed: document.extensionsUsed ?? [],
    extensionsRequired: document.extensionsRequired ?? [],
    uriReferences,
    externalUriReferences,
    selfContained: externalUriReferences.length === 0,
    meshDetails,
    warnings,
    scope: "Header, chunk bounds and metadata inspection only; not full glTF validation, visual approval, mesh manifoldness or rig deformation proof.",
  };
}

module.exports = { inspectGlb };
if (require.main === module) {
  const filename = process.argv[2];
  if (!filename || process.argv.length !== 3) {
    process.stderr.write("Usage: node inspect-glb.cjs path/to/model.glb\n");
    process.exitCode = 2;
  } else {
    try { process.stdout.write(`${JSON.stringify(inspectGlb(fs.readFileSync(filename), filename), null, 2)}\n`); }
    catch (error) { process.stderr.write(`GLB inspection failed: ${error.message}\n`); process.exitCode = 1; }
  }
}
