import { Document, NodeIO } from "@gltf-transform/core";

const outDir = "./src/public/models";
import { writeFileSync, mkdirSync } from "fs";
mkdirSync(outDir, { recursive: true });

async function createGLB(name, positions, indices, color) {
  const doc = new Document();
  const buffer = doc.createBuffer();

  const posAccessor = doc.createAccessor(name + "_pos")
    .setType("VEC3")
    .setArray(new Float32Array(positions))
    .setBuffer(buffer);

  const idxAccessor = doc.createAccessor(name + "_idx")
    .setType("SCALAR")
    .setArray(new Uint16Array(indices))
    .setBuffer(buffer);

  const material = doc.createMaterial(name + "_mat")
    .setBaseColorFactor(color)
    .setMetallicFactor(0.2)
    .setRoughnessFactor(0.8);

  const prim = doc.createPrimitive()
    .setAttribute("POSITION", posAccessor)
    .setIndices(idxAccessor)
    .setMaterial(material);

  const mesh = doc.createMesh(name + "_mesh").addPrimitive(prim);
  const node = doc.createNode(name + "_node").setMesh(mesh);
  const scene = doc.createScene(name + "_scene").addChild(node);

  const io = new NodeIO();
  const glb = await io.writeBinary(doc);
  writeFileSync(`${outDir}/${name}.glb`, Buffer.from(glb));
  console.log(`Created ${name}.glb`);
}

// Airplane - simple delta wing shape (nose at -X, Y up)
await createGLB("airplane", [
  // Fuselage (elongated box)
  -1.5, 0, 0,    1.5, 0, 0,    1.5, 0.15, 0,   -1.5, 0.15, 0,  // bottom
  -1.5, 0, 0,   -1.5, 0.15, 0, -1.5, 0.15, 0.3, -1.5, 0, 0.3,  // front
   1.5, 0, 0,    1.5, 0, 0.3,  1.5, 0.15, 0.3,  1.5, 0.15, 0,  // back
  // Wings
  -0.3, 0.05, 0,  0.5, 0.05, 0,  0.5, 0.05, 2.0, -0.3, 0.05, 2.0,
  -0.3, 0.05, 0, -0.3, 0.05, 2.0,  0.5, 0.05, 2.0,  0.5, 0.05, 0,
  // Tail
   1.0, 0.1, 0,   1.5, 0.1, 0,   1.5, 0.1, 0.6,  1.0, 0.1, 0.6,
], [
  0,1,2, 0,2,3,  4,5,6, 4,6,7,  8,9,10, 8,10,11, 12,13,14, 12,14,15,
], [0.85, 0.9, 1.0, 1.0]);

// Jet - sleek fighter shape
await createGLB("jet", [
  // Fuselage
  -2.0, 0, 0,   0.8, 0, 0,   0.8, 0.12, 0,  -2.0, 0.12, 0,
  // Nose cone
  -2.0, 0, 0,  -2.5, 0.06, 0, -2.0, 0.12, 0,
  // Wings (swept)
  -0.5, 0.06, 0,  0.3, 0.06, 0,  0.6, 0.06, 1.5, -0.2, 0.06, 1.2,
  -0.5, 0.06, 0, -0.2, 0.06, 1.2, 0.6, 0.06, 1.5, 0.3, 0.06, 0,
  // Tail fin
   0.5, 0.1, 0,  0.8, 0.1, 0,  0.8, 0.5, 0,  0.5, 0.5, 0,
], [
  0,1,2, 0,2,3,  4,5,6,  7,8,9, 7,9,10, 11,12,13, 11,13,14,
], [0.3, 0.35, 0.45, 1.0]);

// Ship - cargo vessel (flat bottom, boxy hull)
await createGLB("ship", [
  // Hull bottom
  -2.0, -0.3, 0,  2.0, -0.3, 0,  2.0, -0.3, 0.8, -2.0, -0.3, 0.8,
  // Hull top
  -2.0, 0, 0,  -2.0, 0, 0.8,  2.0, 0, 0.8,  2.0, 0, 0,
  // Deck
  -1.8, 0, 0.1,  1.8, 0, 0.1,  1.8, 0, 0.7, -1.8, 0, 0.7,
  // Bridge
   1.0, 0, 0.3,  1.6, 0, 0.3,  1.6, 0, 0.7,  1.0, 0, 0.7,
], [
  0,1,2, 0,2,3,  4,5,6, 4,6,7,  8,9,10, 8,10,11, 12,13,14, 12,14,15,
], [0.4, 0.55, 0.65, 1.0]);

// Military jet (MQ-9 style drone)
await createGLB("military", [
  // Fuselage
  -1.8, 0, 0,   0.6, 0, 0,   0.6, 0.08, 0,  -1.8, 0.08, 0,
  // Wings (long, thin)
  -0.2, 0.04, 0,  0.2, 0.04, 0,  0.2, 0.04, 2.5, -0.2, 0.04, 2.5,
  -0.2, 0.04, 0, -0.2, 0.04, 2.5, 0.2, 0.04, 2.5, 0.2, 0.04, 0,
  // V-tail
   0.4, 0.06, 0,  0.6, 0.06, 0,  0.6, 0.35, 0.3, 0.4, 0.35, 0.3,
], [
  0,1,2, 0,2,3,  4,5,6, 4,6,7, 8,9,10, 8,10,11, 12,13,14, 12,14,15,
], [0.35, 0.4, 0.35, 1.0]);

console.log("All models created!");
