export class DriftScorer {
  public totalScore: number = 0;
  public currentDriftPoints: number = 0;
  private comboMultiplier: number = 1;

  public update(dt: number, isDrifting: boolean, speedKmh: number) {
    if (isDrifting && speedKmh > 35) {
      this.currentDriftPoints += dt * speedKmh * 4 * this.comboMultiplier;
      if (this.currentDriftPoints > 500) this.comboMultiplier = 2;
      if (this.currentDriftPoints > 1500) this.comboMultiplier = 3;
    } else if (this.currentDriftPoints > 0) {
      // Simpan poin ke total skor saat drift selesai
      this.totalScore += Math.round(this.currentDriftPoints);
      this.currentDriftPoints = 0;
      this.comboMultiplier = 1;
    }
  }

  public getMultiplier(): number {
    return this.comboMultiplier;
  }
}
