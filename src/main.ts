import "./style.css";
import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  Color3,
  Color4,
  FollowCamera,
} from "@babylonjs/core";
import { CarController } from "./controllers/CarController";
import { DriftScorer } from "./DriftScorer";
import { TrackBuilder } from "./TrackBuilder";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);

const createScene = (): Scene => {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.95, 0.65, 0.45, 1.0);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.002;
  scene.fogColor = new Color3(0.95, 0.65, 0.45);

  const hemiLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), scene);
  hemiLight.intensity = 0.75;

  const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -2, -1), scene);
  dirLight.position = new Vector3(50, 100, 50);
  dirLight.intensity = 0.85;

  // Bangun Lintasan Jalan Raya Berkelok
  const track = new TrackBuilder();
  track.build(scene);

  // Inisialisasi Mobil & Sejajarkan di Garis Start
  const car = new CarController(scene);
  car.setStartTransform(track.startPosition, track.startRotationY);

  const scorer = new DriftScorer();

  const camera = new FollowCamera("followCam", new Vector3(0, 10, -15), scene);
  camera.lockedTarget = car.carRoot;
  camera.radius = 12;
  camera.heightOffset = 4.5;
  camera.rotationOffset = 180;
  camera.cameraAcceleration = 0.08;
  camera.maxCameraSpeed = 30;

  // State Input Gabungan (Keyboard + Layar Sentuh)
  const keys: Record<string, boolean> = {};
  const touchState = {
    left: false,
    right: false,
    gas: false,
    brake: false,
    drift: false,
  };

  window.addEventListener("keydown", (e) => (keys[e.code] = true));
  window.addEventListener("keyup", (e) => (keys[e.code] = false));

  // Fungsi Pengikat Tombol Layar Sentuh (Multi-Touch)
  const bindTouchButton = (elementId: string, actionKey: keyof typeof touchState) => {
    const btn = document.getElementById(elementId);
    if (!btn) return;

    const press = (e: Event) => {
      e.preventDefault();
      touchState[actionKey] = true;
      btn.classList.add("active");
    };

    const release = (e: Event) => {
      e.preventDefault();
      touchState[actionKey] = false;
      btn.classList.remove("active");
    };

    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("pointercancel", release);
  };

  bindTouchButton("btn-left", "left");
  bindTouchButton("btn-right", "right");
  bindTouchButton("btn-gas", "gas");
  bindTouchButton("btn-brake", "brake");
  bindTouchButton("btn-drift", "drift");

  // Elemen HUD
  const speedEl = document.getElementById("speed")!;
  const scoreEl = document.getElementById("score")!;
  const statusEl = document.getElementById("drift-status")!;

  // Loop Utama Game
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);

    const isGas = keys["KeyW"] || keys["ArrowUp"] || touchState.gas;
    const isBrake = keys["KeyS"] || keys["ArrowDown"] || touchState.brake;
    const isRight = keys["KeyD"] || keys["ArrowRight"] || touchState.right;
    const isLeft = keys["KeyA"] || keys["ArrowLeft"] || touchState.left;
    const handbrake = Boolean(keys["Space"] || touchState.drift);

    const throttle = (isGas ? 1 : 0) - (isBrake ? 1 : 0);
    const steer = (isRight ? 1 : 0) - (isLeft ? 1 : 0);

    car.update(dt, { throttle, steer, handbrake });
    const speedKmh = car.getSpeedKmh();
    scorer.update(dt, car.isDrifting, speedKmh);

    speedEl.textContent = `Kecepatan: ${speedKmh} km/h`;
    scoreEl.textContent = `Total Skor: ${scorer.totalScore.toLocaleString("id-ID")}`;

    if (scorer.currentDriftPoints > 0) {
      statusEl.textContent = `DRIFTING! +${Math.round(scorer.currentDriftPoints)} (x${scorer.getMultiplier()})`;
    } else {
      statusEl.textContent = "";
    }
  });

  return scene;
};

const scene = createScene();

engine.runRenderLoop(() => {
  scene.render();
});

window.addEventListener("resize", () => {
  engine.resize();
});
