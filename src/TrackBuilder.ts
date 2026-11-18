import {
  Scene,
  Vector3,
  Curve3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  DynamicTexture,
} from "@babylonjs/core";

export class TrackBuilder {
  public startPosition: Vector3 = new Vector3(0, 0.6, 0);
  public startRotationY: number = 0;

  public build(scene: Scene): void {
    // 1. Dataran Rumput / Lembah Hijau di Luar Lintasan
    const ground = MeshBuilder.CreateGround("grassGround", { width: 1400, height: 1400 }, scene);
    const groundMat = new StandardMaterial("grassMat", scene);
    groundMat.diffuseColor = new Color3(0.18, 0.35, 0.16);
    groundMat.specularColor = new Color3(0, 0, 0);
    ground.material = groundMat;

    // 2. Titik-Titik Utama Sirkuit Berkelok (Closed Loop)
    const controlPoints = [
      new Vector3(0, 0, 0),       // Garis Start / Lurus Utama
      new Vector3(0, 0, 120),     // Menuju Tikungan 1
      new Vector3(70, 0, 190),    // Tikungan Kanan Lebar
      new Vector3(180, 0, 160),   // Chicane (Tikungan S)
      new Vector3(220, 0, 60),
      new Vector3(140, 0, -20),   // Tikungan Tajam (Hairpin)
      new Vector3(230, 0, -110),  // Tikungan Panjang ke Selatan
      new Vector3(150, 0, -210),
      new Vector3(20, 0, -190),   // Tikungan Balik Menuju Garis Finish
      new Vector3(-40, 0, -100),
    ];

    // Simpan arah hadap awal mobil mengikuti titik ke-2
    const initialDir = controlPoints[1].subtract(controlPoints[0]).normalize();
    this.startRotationY = Math.atan2(initialDir.x, initialDir.z);

    // 3. Haluskan Jalur Menjadi Kurva Sirkuit (400 Segmen)
    const catmullRom = Curve3.CreateCatmullRomSpline(controlPoints, 40, true);
    const points = catmullRom.getPoints();

    const roadWidth = 22; // Lebar jalan aspal
    const leftEdge: Vector3[] = [];
    const rightEdge: Vector3[] = [];
    const leftKerbOuter: Vector3[] = [];
    const rightKerbOuter: Vector3[] = [];

    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      const next = points[(i + 1) % points.length];
      const forward = next.subtract(curr).normalize();
      const right = new Vector3(forward.z, 0, -forward.x); // Vektor ke samping kanan jalan

      // Tinggi Y sedikit dinaikkan (0.05) agar tidak bertabrakan dengan rumput (z-fighting)
      leftEdge.push(curr.add(right.scale(-roadWidth / 2)).add(new Vector3(0, 0.05, 0)));
      rightEdge.push(curr.add(right.scale(roadWidth / 2)).add(new Vector3(0, 0.05, 0)));

      // Pembatas pinggir jalan (Kerb) selebar 1.5 meter
      leftKerbOuter.push(curr.add(right.scale(-roadWidth / 2 - 1.5)).add(new Vector3(0, 0.08, 0)));
      rightKerbOuter.push(curr.add(right.scale(roadWidth / 2 + 1.5)).add(new Vector3(0, 0.08, 0)));
    }

    // 4. Tekstur Aspal & Garis Marka Jalan
    const roadTex = new DynamicTexture("roadTex", { width: 512, height: 512 }, scene, false);
    const ctx = roadTex.getContext();

    // Warna dasar aspal gelap
    ctx.fillStyle = "#2b2d30";
    ctx.fillRect(0, 0, 512, 512);

    // Garis tepi putih kiri & kanan
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(16, 0, 12, 512);
    ctx.fillRect(484, 0, 12, 512);

    // Garis putus-putus tengah jalan
    ctx.fillStyle = "#ffb703";
    ctx.fillRect(250, 40, 12, 180);
    ctx.fillRect(250, 300, 12, 180);
    roadTex.update();
    roadTex.vScale = 45; // Ulang tekstur sepanjang lintasan

    const roadMat = new StandardMaterial("roadMat", scene);
    roadMat.diffuseTexture = roadTex;
    roadMat.specularColor = new Color3(0.08, 0.08, 0.08);

    // Bangun Mesh Jalan Aspal
    const roadMesh = MeshBuilder.CreateRibbon(
      "raceTrack",
      { pathArray: [leftEdge, rightEdge], closeArray: false, closePath: false },
      scene
    );
    roadMesh.material = roadMat;

    // 5. Bangun Pembatas Sirkuit (Kerb Merah-Putih)
    const kerbTex = new DynamicTexture("kerbTex", { width: 64, height: 64 }, scene, false);
    const kCtx = kerbTex.getContext();
    kCtx.fillStyle = "#d62828";
    kCtx.fillRect(0, 0, 64, 32);
    kCtx.fillStyle = "#f8f9fa";
    kCtx.fillRect(0, 32, 64, 32);
    kerbTex.update();
    kerbTex.vScale = 120;

    const kerbMat = new StandardMaterial("kerbMat", scene);
    kerbMat.diffuseTexture = kerbTex;
    kerbMat.specularColor = new Color3(0, 0, 0);

    const leftKerb = MeshBuilder.CreateRibbon(
      "leftKerb",
      { pathArray: [leftKerbOuter, leftEdge], closeArray: false, closePath: false },
      scene
    );
    leftKerb.material = kerbMat;

    const rightKerb = MeshBuilder.CreateRibbon(
      "rightKerb",
      { pathArray: [rightEdge, rightKerbOuter], closeArray: false, closePath: false },
      scene
    );
    rightKerb.material = kerbMat;

    // 6. Tambahkan Pohon & Patok Pembatas di Sekitar Lintasan sebagai Penanda Kecepatan
    const trunkMat = new StandardMaterial("trunkMat", scene);
    trunkMat.diffuseColor = new Color3(0.35, 0.22, 0.12);
    const leafMat = new StandardMaterial("leafMat", scene);
    leafMat.diffuseColor = new Color3(0.12, 0.42, 0.15);

    for (let i = 0; i < points.length; i += 8) {
      const curr = points[i];
      const next = points[(i + 1) % points.length];
      const forward = next.subtract(curr).normalize();
      const right = new Vector3(forward.z, 0, -forward.x);

      // Tempatkan pohon secara selang-seling di sisi luar jalan
      const side = i % 16 === 0 ? 1 : -1;
      const treePos = curr.add(right.scale(side * (roadWidth / 2 + 10)));

      const trunk = MeshBuilder.CreateCylinder(`trunk_${i}`, { diameter: 0.8, height: 3 }, scene);
      trunk.position = new Vector3(treePos.x, 1.5, treePos.z);
      trunk.material = trunkMat;

      const leaves = MeshBuilder.CreateCylinder(
        `leaves_${i}`,
        { diameterTop: 0, diameterBottom: 4.5, height: 7 },
        scene
      );
      leaves.position = new Vector3(treePos.x, 5.5, treePos.z);
      leaves.material = leafMat;
    }
  }
}
