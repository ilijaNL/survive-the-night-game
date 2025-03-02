import {
  ClientPositionable,
  ClientMovable,
  ClientDestructible,
  ClientIgnitable,
  ClientCollidable,
} from "@/extensions";
import { ClientEntityBase } from "@/extensions/client-entity";
import { AssetManager } from "@/managers/asset";
import { GameState } from "@/state";
import { debugDrawHitbox, drawCenterPositionWithLabel } from "@/util/debug";
import { getPlayer } from "@/util/get-player";
import { renderInteractionText } from "@/util/interaction-text";
import { createFlashEffect } from "@/util/render";
import { RawEntity } from "@shared/types/entity";
import { Z_INDEX } from "@shared/map";
import { IClientEntity, Renderable, getFrameIndex, drawHealthBar } from "@/entities/util";
import Vector2 from "@shared/util/vector2";
import { DEBUG_SHOW_WAYPOINTS } from "@shared/debug";
import { determineDirection } from "@shared/util/direction";
import { getHitboxWithPadding } from "@shared/util/hitbox";
import { roundVector2 } from "@shared/util/physics";

export abstract class EnemyClient extends ClientEntityBase implements IClientEntity, Renderable {
  private lastRenderPosition = { x: 0, y: 0 };
  private previousHealth: number | undefined;
  private damageFlashUntil: number = 0;
  protected debugWaypoint: Vector2 | null = null;

  constructor(data: RawEntity, assetManager: AssetManager) {
    super(data, assetManager);
  }

  public getZIndex(): number {
    return Z_INDEX.ENEMIES;
  }

  protected getPosition(): Vector2 {
    const positionable = this.getExt(ClientPositionable);
    const position = positionable.getPosition();
    return position;
  }

  getCenterPosition(): Vector2 {
    const positionable = this.getExt(ClientPositionable);
    return positionable.getCenterPosition();
  }

  setVelocity(velocity: Vector2): void {
    const movable = this.getExt(ClientMovable);
    movable.setVelocity(velocity);
  }

  getVelocity(): Vector2 {
    const movable = this.getExt(ClientMovable);
    return movable.getVelocity();
  }

  getMaxHealth(): number {
    const destructible = this.getExt(ClientDestructible);
    return destructible.getMaxHealth();
  }

  getHealth(): number {
    const destructible = this.getExt(ClientDestructible);
    return destructible.getHealth();
  }

  deserializeProperty(key: string, value: any): void {
    super.deserializeProperty(key, value);
    if (key === "debugWaypoint") {
      this.debugWaypoint = value;
    }
  }

  render(ctx: CanvasRenderingContext2D, gameState: GameState): void {
    const currentHealth = this.getHealth();

    if (this.previousHealth !== undefined && currentHealth < this.previousHealth) {
      this.damageFlashUntil = Date.now() + 250;
    }
    this.previousHealth = currentHealth;

    const targetPosition = this.getPosition();

    this.lastRenderPosition = this.lerpPosition(
      targetPosition,
      new Vector2(this.lastRenderPosition.x, this.lastRenderPosition.y)
    );

    const renderPosition = roundVector2(
      new Vector2(this.lastRenderPosition.x, this.lastRenderPosition.y)
    );

    const destructible = this.getExt(ClientDestructible);
    const isDead = destructible.isDead();

    isDead
      ? this.renderEnemyDead(gameState, ctx, renderPosition)
      : this.renderEnemyAlive(gameState, ctx, renderPosition);

    this.renderDebugWaypoint(ctx);
  }

  protected renderDebugWaypoint(ctx: CanvasRenderingContext2D): void {
    if (DEBUG_SHOW_WAYPOINTS && this.debugWaypoint) {
      const waypoint = this.debugWaypoint;
      ctx.save();
      ctx.strokeStyle = this.getDebugWaypointColor();
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(this.lastRenderPosition.x + 8, this.lastRenderPosition.y + 8);
      ctx.lineTo(waypoint.x, waypoint.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(waypoint.x, waypoint.y, 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  protected abstract getDebugWaypointColor(): string;
  protected abstract getEnemyAssetPrefix(): string;
  protected abstract getAnimationDuration(): number;

  protected renderFlames(
    gameState: GameState,
    ctx: CanvasRenderingContext2D,
    renderPosition: Vector2
  ) {
    const isOnFire = this.hasExt(ClientIgnitable);
    if (!isOnFire) return;

    const frameIndex = getFrameIndex(gameState.startedAt, {
      duration: 500,
      frames: 5,
    });
    const fireImg = this.imageLoader.getFrameIndex("flame", frameIndex);
    ctx.drawImage(fireImg, renderPosition.x, renderPosition.y);
  }

  protected renderEnemyAlive(
    gameState: GameState,
    ctx: CanvasRenderingContext2D,
    renderPosition: Vector2
  ) {
    const facing = determineDirection(this.getVelocity());
    const frameIndex = getFrameIndex(gameState.startedAt, {
      duration: this.getAnimationDuration(),
      frames: 3,
    });
    const image = this.imageLoader.getFrameWithDirection(
      this.getEnemyAssetPrefix(),
      facing,
      frameIndex
    );
    ctx.drawImage(image, renderPosition.x, renderPosition.y);
    drawHealthBar(ctx, renderPosition, this.getHealth(), this.getMaxHealth());

    // Debug hitboxes
    const positionable = this.getExt(ClientPositionable);
    const collidable = this.getExt(ClientCollidable);
    debugDrawHitbox(ctx, collidable.getHitBox(), "yellow");
    debugDrawHitbox(ctx, getHitboxWithPadding(positionable.getPosition(), 0), "red");
    drawCenterPositionWithLabel(ctx, this.getCenterPosition());

    this.renderFlames(gameState, ctx, renderPosition);
    this.renderFlashEffect(image, ctx, renderPosition);
  }

  protected renderFlashEffect(
    image: HTMLImageElement,
    ctx: CanvasRenderingContext2D,
    renderPosition: Vector2
  ) {
    if (Date.now() > this.damageFlashUntil) {
      return;
    }

    const flashEffect = createFlashEffect(image);
    ctx.drawImage(flashEffect, renderPosition.x, renderPosition.y);
  }

  protected renderEnemyDead(
    gameState: GameState,
    ctx: CanvasRenderingContext2D,
    renderPosition: Vector2
  ) {
    const myPlayer = getPlayer(gameState);
    const image = this.imageLoader.get(`${this.getEnemyAssetPrefix()}_dead`);
    ctx.drawImage(image, renderPosition.x, renderPosition.y);

    if (myPlayer) {
      renderInteractionText(
        ctx,
        "loot (e)",
        this.getCenterPosition(),
        this.getPosition(),
        myPlayer.getPosition()
      );
    }
  }
}
