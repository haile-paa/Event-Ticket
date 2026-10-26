"use client";

import { Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const W = 3.3;
const H = 2;

/** A ticket outline with a half-circle punched out of each side. */
function ticketShape() {
  const x = -W / 2;
  const y = -H / 2;
  const r = 0.2;
  const n = 0.2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + W - r, y);
  s.quadraticCurveTo(x + W, y, x + W, y + r);
  s.lineTo(x + W, -n);
  s.absarc(x + W, 0, n, -Math.PI / 2, Math.PI / 2, true);
  s.lineTo(x + W, y + H - r);
  s.quadraticCurveTo(x + W, y + H, x + W - r, y + H);
  s.lineTo(x + r, y + H);
  s.quadraticCurveTo(x, y + H, x, y + H - r);
  s.lineTo(x, n);
  s.absarc(x, 0, n, Math.PI / 2, -Math.PI / 2, true);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function drawFace(
  c1: string,
  c2: string,
  c3: string,
  l1: string,
  l2: string,
  sub: string,
  font: string,
  sans: string,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1320;
  c.height = 800;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, c.width, c.height);
  bg.addColorStop(0, c1);
  bg.addColorStop(0.55, c2);
  bg.addColorStop(1, c3);
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);

  // soft light streaks
  g.globalAlpha = 0.14;
  g.fillStyle = "#fff";
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.moveTo(i * 190 - 200, 0);
    g.lineTo(i * 190 - 120, 0);
    g.lineTo(i * 190 + 320, c.height);
    g.lineTo(i * 190 + 240, c.height);
    g.fill();
  }
  g.globalAlpha = 1;

  g.fillStyle = "#0a0a12";
  g.font = `800 150px ${font}, Helvetica, Arial, sans-serif`;
  g.textBaseline = "alphabetic";
  g.fillText(l1, 90, 300, 820);
  g.fillText(l2, 90, 450, 820);

  g.font = `700 34px ${sans}, Helvetica, Arial, sans-serif`;
  g.fillStyle = "rgba(10,10,18,.8)";
  g.fillText(sub, 94, 540, 820);

  // perforation
  g.strokeStyle = "rgba(10,10,18,.55)";
  g.lineWidth = 6;
  g.setLineDash([4, 20]);
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(960, 60);
  g.lineTo(960, c.height - 60);
  g.stroke();
  g.setLineDash([]);

  // barcode
  g.fillStyle = "#0a0a12";
  let x = 1010;
  const bars = [10, 4, 14, 6, 6, 12, 4, 8, 14, 5, 9, 4, 12];
  bars.forEach((b, i) => {
    if (x < 1270) g.fillRect(x, 190, b, 360);
    x += b + (i % 2 ? 9 : 6);
  });
  g.save();
  g.translate(1252, 640);
  g.font = `700 28px ${sans}, Helvetica, Arial, sans-serif`;
  g.textAlign = "right";
  g.fillText("No. 000 777", 0, 0);
  g.restore();
  return c;
}

function TicketMesh({
  colors,
  l1,
  l2,
  sub,
}: {
  colors: [string, string, string];
  l1: string;
  l2: string;
  sub: string;
}) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);

  const { body, face } = useMemo(() => {
    const shape = ticketShape();
    const body = new THREE.ExtrudeGeometry(shape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.035,
      bevelSegments: 5,
      curveSegments: 40,
    });
    body.translate(0, 0, -0.07);

    // front face with the artwork; remap UVs from shape coordinates to 0..1
    const face = new THREE.ShapeGeometry(shape, 40);
    const pos = face.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) + W / 2) / W;
      uv[i * 2 + 1] = (pos.getY(i) + H / 2) / H;
    }
    face.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return { body, face };
  }, []);

  const texture = useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    const font = (
      cs.getPropertyValue("--font-display").split(",")[0] || "Helvetica"
    ).trim();
    const sans = (
      cs.getPropertyValue("--font-sans").split(",")[0] || "Helvetica"
    ).trim();
    const t = new THREE.CanvasTexture(
      drawFace(colors[0], colors[1], colors[2], l1, l2, sub, font, sans),
    );
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [colors, l1, l2, sub]);

  // the artwork is drawn on a canvas: redraw it once the web fonts have loaded, and free it on unmount
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      const cs = getComputedStyle(document.documentElement);
      const font = (
        cs.getPropertyValue("--font-display").split(",")[0] || "Helvetica"
      ).trim();
      const sans = (
        cs.getPropertyValue("--font-sans").split(",")[0] || "Helvetica"
      ).trim();
      const c = texture.image as HTMLCanvasElement;
      c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
      c.getContext("2d")!.drawImage(
        drawFace(colors[0], colors[1], colors[2], l1, l2, sub, font, sans),
        0,
        0,
      );
      texture.needsUpdate = true;
    });
    return () => {
      alive = false;
    };
  }, [texture, colors, l1, l2, sub]);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (g) {
      const ty = state.pointer.x * 0.55 + Math.sin(t * 0.6) * 0.18;
      const tx = -state.pointer.y * 0.35 + Math.cos(t * 0.5) * 0.06;
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, ty, 3.2, dt);
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, tx, 3.2, dt);
      g.position.y = Math.sin(t * 0.9) * 0.1;
    }
    if (ring.current) {
      ring.current.rotation.z = t * 0.18;
      ring.current.rotation.x = Math.PI / 2.4 + Math.sin(t * 0.4) * 0.08;
    }
  });

  return (
    <>
      <group ref={group} rotation={[0.05, -0.35, 0.08]}>
        <mesh geometry={body}>
          <meshStandardMaterial
            color='#3a2670'
            emissive='#1b1030'
            emissiveIntensity={0.6}
            metalness={0.35}
            roughness={0.35}
          />
        </mesh>
        <mesh geometry={face} position={[0, 0, 0.13]} renderOrder={2}>
          <meshBasicMaterial
            map={texture}
            toneMapped={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        <mesh
          geometry={face}
          position={[0, 0, -0.13]}
          rotation={[0, Math.PI, 0]}
        >
          <meshBasicMaterial color='#20123a' />
        </mesh>
      </group>
      <mesh ref={ring} position={[0, 0, -0.4]}>
        <torusGeometry args={[2.55, 0.014, 16, 160]} />
        <meshBasicMaterial color={colors[0]} transparent opacity={0.55} />
      </mesh>
      <mesh rotation={[Math.PI / 2.8, 0.3, 0]} position={[0, 0, -0.5]}>
        <torusGeometry args={[3.1, 0.01, 16, 160]} />
        <meshBasicMaterial color={colors[1]} transparent opacity={0.35} />
      </mesh>
    </>
  );
}

export default function HeroScene({
  colors,
  line1,
  line2,
  sub,
}: {
  colors: [string, string, string];
  line1: string;
  line2: string;
  sub: string;
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 5.6], fov: 40, near: 2, far: 20 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ touchAction: "pan-y" }}
    >
      <ambientLight intensity={0.8} />
      <pointLight position={[3, 3, 4]} intensity={40} color={colors[1]} />
      <pointLight position={[-4, -2, 3]} intensity={30} color={colors[0]} />
      <TicketMesh colors={colors} l1={line1} l2={line2} sub={sub} />
      <Sparkles
        count={70}
        scale={[7, 4.5, 3]}
        size={3.2}
        speed={0.45}
        color={colors[2]}
        opacity={0.9}
      />
      <Sparkles
        count={40}
        scale={[6, 4, 2]}
        size={2}
        speed={0.3}
        color={colors[0]}
      />
    </Canvas>
  );
}
