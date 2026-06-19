// Sobre manila a partir del modelo de Blender (public/models/manila-envelope.glb):
//   · ManilaEnvelope     → el cuerpo/bolsa (cara frontal = donde va el texto)
//   · ManilaEnvelopeOpen → la solapa, con bisagra en el borde superior; se abre
//     girando sobre su origen (la coreografía mueve `flap.rotation`).
// El texto impreso y el sticker se superponen como planos (reusan textures.js),
// así no hace falta UV-mapear el modelo.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PALETTE } from "./config.js";
import { envelopeFrontTexture, stickerTexture } from "./textures.js";

// Footprint de referencia (la envelope procedural medía esto): mantenemos los
// mismos números para que la coreografía de páginas/tarjeta siga cuadrando.
export const ENV_W = 4.6;
export const ENV_H = 3.1;
export const ENV_GAP = 0.32;

const GLB = "/tarjeta/models/manila-envelope.glb";

export async function buildEnvelope(invite, emblem) {
  const group = new THREE.Group();
  group.name = "envelope";

  const gltf = await new GLTFLoader().loadAsync(GLB);
  const model = gltf.scene;
  model.name = "envelope-model";

  const body = model.getObjectByName("ManilaEnvelope");
  const flap = model.getObjectByName("ManilaEnvelopeOpen");

  // material manila para todo el modelo
  const paper = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.paper),
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  model.traverse((o) => { if (o.isMesh) o.material = paper; });

  // --- orientar + escalar para ocupar el hueco de la envelope vieja ----------
  // El GLB ya viene Y-up y con el frente (cara impresa + solapa) mirando a +Z,
  // es decir hacia la cámara, así que no hace falta girar en Y.
  model.rotation.y = 0;
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const fit = ENV_W / size.x;          // escala para que el ancho ≈ ENV_W
  model.scale.setScalar(fit);
  model.updateMatrixWorld(true);
  // recentrar en el origen del grupo (pose cerrada)
  box = new THREE.Box3().setFromObject(model);
  model.position.sub(box.getCenter(new THREE.Vector3()));

  group.add(model);

  // --- texto impreso del frente ----------------------------------------------
  // Plano con la textura de la envelope (dirección abajo, sello/matasellos
  // arriba) justo delante de la cara frontal de la bolsa. Va detrás del frente
  // de la solapa: la solapa cerrada tapa la mitad superior (sello) y la revela
  // al abrirse; la dirección queda siempre visible abajo. MeshStandard para que
  // el manila del plano reciba la misma luz que el modelo y no se note el corte.
  const frontTex = envelopeFrontTexture(invite);
  const text = new THREE.Mesh(
    new THREE.PlaneGeometry(4.5, 3.18),
    new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.92, metalness: 0 }),
  );
  text.name = "envelope-text";
  text.position.set(0, 0, 0.108); // delante de la bolsa (~0.10), detrás del frente de la solapa (~0.11)
  group.add(text);

  // --- sticker de cierre en la punta de la solapa ----------------------------
  // Cuelga de la solapa (gira con ella). La solapa tiene escala no uniforme del
  // GLB, así que el sticker la compensa para quedar redondo. Posición/tamaño
  // afinables en vivo con __env.stk(x,y,z) / __env.stkR(r).
  let sticker = null;
  if (flap) {
    const fs = flap.scale; // escala local no uniforme de la solapa
    sticker = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshStandardMaterial({ map: stickerTexture(emblem), roughness: 0.85, transparent: true }),
    );
    sticker.name = "envelope-sticker";
    const r = 0.7;
    sticker.scale.set(r / fs.x, r / fs.y, r / fs.z); // queda circular pese a la escala de la solapa
    sticker.position.set(0, -1.45, 0.25); // punta de la solapa (punto de cierre), por delante de su cara
    flap.add(sticker);
  }

  // --- ajuste en vivo (consola): __env.flapDeg(-130) · .txtZ(0.11) · .stk(x,y,z) ---
  window.__env = Object.assign(window.__env || {}, {
    flapDeg: (d) => { if (flap) flap.rotation.x = THREE.MathUtils.degToRad(d); console.log("flap°", d); },
    txtZ: (z) => { text.position.z = z; console.log("text.z", z); },
    stk: (x, y, z) => { if (sticker) { sticker.position.set(x, y, z); console.log("stk", x, y, z); } },
    stkR: (r) => { if (sticker && flap) { const fs = flap.scale; sticker.scale.set(r / fs.x, r / fs.y, r / fs.z); console.log("stkR", r); } },
  });

  return { group, flap, body };
}
