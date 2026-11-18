import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  Scalar,
  ParticleSystem,
  Texture,
  Color4,
} from "@babylonjs/core";

export class CarController {
  public carRoot: Mesh;
  private velocity: Vector3 = Vector3.Zero();
  private speed: number = 0;
  private headingAngle: number = 0;
  public isDrifting: boolean = false;
  private smokeLeft: ParticleSystem;
  private smokeRight: ParticleSystem;

  constructor(scene: Scene) {
    // 1. Membuat Bodi Mobil Sementara (Prototipe)
    this.carRoot = new Mesh("carRoot", scene);
    this.carRoot.position = new Vector3(0, 0.6, 0);

    const body = MeshBuilder.CreateBox("carBody", { width: 2, height: 0.7, depth: 4.2 }, scene);
    body.parent = this.carRoot;
    const bodyMat = new StandardMaterial("bodyMat", scene);
    bodyMat.diffuseColor = new Color3(0.85, 0.15, 0.15); // Merah menyala
    body.material = bodyMat;

    const cabin = MeshBuilder.CreateBox("carCabin", { width: 1.6, height: 0.5, depth: 2.0 }, scene);
    cabin.position = new Vector3(0, 0.55, -0.3);
    cabin.parent = this.carRoot;
    const cabinMat = new StandardMaterial("cabinMat", scene);
    cabinMat.diffuseColor = new Color3(0.15, 0.15, 0.2);
    cabin.material = cabinMat;

    

    // 2. Membuat 4 Roda
    const wheelPositions = [
      new Vector3(-1.05, -0.2, 1.3),  // Depan Kiri
      new Vector3(1.05, -0.2, 1.3),   // Depan Kanan
      new Vector3(-1.05, -0.2, -1.3), // Belakang Kiri
      new Vector3(1.05, -0.2, -1.3),  // Belakang Kanan
    ];

    const wheelMat = new StandardMaterial("wheelMat", scene);
    wheelMat.diffuseColor = new Color3(0.1, 0.1, 0.1);

    wheelPositions.forEach((pos, idx) => {
      const wheel = MeshBuilder.CreateCylinder(`wheel_${idx}`, { diameter: 0.8, height: 0.4 }, scene);
      wheel.rotation.z = Math.PI / 2;
      wheel.position = pos;
      wheel.parent = this.carRoot;
      wheel.material = wheelMat;
    });

    // 3. Sistem Partikel Asap Ban Belakang
    this.smokeLeft = this.createSmokeSystem(scene, new Vector3(-0.9, -0.4, -1.5));
    this.smokeRight = this.createSmokeSystem(scene, new Vector3(0.9, -0.4, -1.5));
  }

    public setStartTransform(position: Vector3, rotationY: number): void {
    this.carRoot.position = position.clone();
    this.headingAngle = rotationY;
    this.carRoot.rotation.y = rotationY;
  }


  private createSmokeSystem(scene: Scene, offset: Vector3): ParticleSystem {
    const emitter = new Mesh("smokeEmitter", scene);
    emitter.parent = this.carRoot;
    emitter.position = offset;

    const ps = new ParticleSystem("driftSmoke", 300, scene);
    // Menggunakan tekstur lingkaran prosedural bawaan atau data URL putih lembut
    ps.particleTexture = new Texture(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAIklEQVQYlWNgYGD4z4AE/jMw/EejYVwGBgaG/2g0jIsBAJ4/B/21226HAAAAAElFTkSuQmCC",
      scene
    );
    ps.emitter = emitter;
    ps.minEmitBox = new Vector3(-0.1, 0, -0.1);
    ps.maxEmitBox = new Vector3(0.1, 0, 0.1);
    ps.color1 = new Color4(0.9, 0.9, 0.9, 0.5);
    ps.color2 = new Color4(0.7, 0.7, 0.7, 0.2);
    ps.colorDead = new Color4(0.5, 0.5, 0.5, 0.0);
    ps.minSize = 0.4;
    ps.maxSize = 1.2;
    ps.minLifeTime = 0.2;
    ps.maxLifeTime = 0.5;
    ps.emitRate = 0;
    ps.start();
    return ps;
  }

  public update(dt: number, input: { throttle: number; steer: number; handbrake: boolean }) {
    const maxSpeed = 48;
    const accelRate = input.throttle !== 0 ? 22 : 10;

    // Hitung kecepatan maju/mundur
    const targetSpeed = input.throttle * maxSpeed;
    this.speed = Scalar.Lerp(this.speed, targetSpeed, dt * (accelRate / maxSpeed) * 3);

    // Rotasi mobil saat belok
    const turnMultiplier = input.handbrake ? 2.6 : 1.7;
    if (Math.abs(this.speed) > 1.0) {
      const reverseDir = this.speed >= 0 ? 1 : -1;
      this.headingAngle += input.steer * turnMultiplier * dt * reverseDir;
    }
    this.carRoot.rotation.y = this.headingAngle;

    // Arah hadap mobil
    const forwardDir = new Vector3(Math.sin(this.headingAngle), 0, Math.cos(this.headingAngle));
    const desiredVelocity = forwardDir.scale(this.speed);

    // Traksi ban: jika handbrake ditekan, traksi menurun drastis sehingga mobil meluncur (drift)
    const grip = input.handbrake ? 1.8 : 7.5;
    this.velocity = Vector3.Lerp(this.velocity, desiredVelocity, dt * grip);

    // Perbarui posisi mobil
    this.carRoot.position.addInPlace(this.velocity.scale(dt));

    // Hitung selisih sudut antara arah hadap dan arah gerak untuk mendeteksi status drift
    const currentSpeed = this.velocity.length();
    if (currentSpeed > 12) {
      const moveDir = this.velocity.normalizeToNew();
      const dot = Vector3.Dot(forwardDir, moveDir);
      const slipAngle = Math.acos(Scalar.Clamp(dot, -1, 1));
      this.isDrifting = slipAngle > 0.28 || (input.handbrake && Math.abs(input.steer) > 0);
    } else {
      this.isDrifting = false;
    }

    // Aktifkan asap ban saat drifting
    const smokeRate = this.isDrifting ? 120 : 0;
    this.smokeLeft.emitRate = smokeRate;
    this.smokeRight.emitRate = smokeRate;
  }

  public getSpeedKmh(): number {
    return Math.round(this.velocity.length() * 3.6);
  }
}
