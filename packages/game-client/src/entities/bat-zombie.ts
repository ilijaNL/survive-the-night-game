import { RawEntity } from "@shared/types/entity";
import { AssetManager } from "@/managers/asset";
import { EnemyClient } from "./enemy-client";

export class BatZombieClient extends EnemyClient {
  constructor(data: RawEntity, assetManager: AssetManager) {
    super(data, assetManager);
  }

  protected getDebugWaypointColor(): string {
    return "purple";
  }

  protected getEnemyAssetPrefix(): string {
    return "bat_zombie";
  }

  protected getAnimationDuration(): number {
    return 200; // Even faster animation for bat zombie
  }
}
