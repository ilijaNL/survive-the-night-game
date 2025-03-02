import { IGameManagers } from "@/managers/types";
import { ZombieDeathEvent } from "@shared/events/server-sent/zombie-death-event";
import { ZombieAttackedEvent } from "@shared/events/server-sent/zombie-attacked-event";
import { Entities } from "@/constants";
import { IEntity } from "@/entities/types";
import Vector2 from "@/util/vector2";
import { ZombieHurtEvent } from "@/events/server-sent/zombie-hurt-event";
import { AttackStrategy, BaseEnemy, MovementStrategy } from "./base-enemy";
import Groupable from "@/extensions/groupable";
import { AcidProjectile } from "../projectiles/acid-projectile";
import Positionable from "@/extensions/positionable";
import Movable from "@/extensions/movable";
import Destructible from "@/extensions/destructible";
import { pathTowards, velocityTowards } from "@/util/physics";
import { Cooldown } from "@/entities/util/cooldown";

class RangedMovementStrategy implements MovementStrategy {
  private static readonly ATTACK_RANGE = 100;
  private pathRecalculationTimer: number = 0;
  private static readonly PATH_RECALCULATION_INTERVAL = 1;
  private currentWaypoint: Vector2 | null = null;

  update(zombie: BaseEnemy, deltaTime: number): boolean {
    this.pathRecalculationTimer += deltaTime;
    const player = zombie.getEntityManager().getClosestAlivePlayer(zombie);
    if (!player) return false;

    const playerPos = player.getExt(Positionable).getCenterPosition();
    const zombiePos = zombie.getCenterPosition();
    const distanceToPlayer = zombiePos.distance(playerPos);

    // If within attack range, stop moving
    if (distanceToPlayer <= RangedMovementStrategy.ATTACK_RANGE) {
      zombie.getExt(Movable).setVelocity(new Vector2(0, 0));
      return false;
    }

    // If we don't have a waypoint or we've reached the current one, get a new one
    const needNewWaypoint = !this.currentWaypoint || zombiePos.distance(this.currentWaypoint) <= 1;

    // Update path periodically or when we need a new waypoint
    if (
      needNewWaypoint ||
      this.pathRecalculationTimer >= RangedMovementStrategy.PATH_RECALCULATION_INTERVAL
    ) {
      this.currentWaypoint = pathTowards(
        zombiePos,
        playerPos,
        zombie.getGameManagers().getMapManager().getMap()
      );
      this.pathRecalculationTimer = 0;
    }

    // If we have a waypoint, move towards it
    if (this.currentWaypoint) {
      const velocity = velocityTowards(zombiePos, this.currentWaypoint);
      zombie.getExt(Movable).setVelocity(velocity.mul(SpitterZombie.ZOMBIE_SPEED));
    } else {
      // If no waypoint found, try moving directly towards player
      const velocity = velocityTowards(zombiePos, playerPos);
      zombie.getExt(Movable).setVelocity(velocity.mul(SpitterZombie.ZOMBIE_SPEED * 0.5)); // Move slower when no path found
    }

    return false; // Let base enemy handle collision movement
  }
}

class RangedAttackStrategy implements AttackStrategy {
  private static readonly ATTACK_RANGE = 100;

  update(zombie: BaseEnemy, deltaTime: number): void {
    if (!(zombie instanceof SpitterZombie)) return;
    if (!zombie.getAttackCooldown().isReady()) return;

    const player = zombie.getEntityManager().getClosestAlivePlayer(zombie);
    if (!player) return;

    const playerPos = player.getExt(Positionable).getCenterPosition();
    const zombiePos = zombie.getCenterPosition();
    const distanceToPlayer = zombiePos.distance(playerPos);

    if (distanceToPlayer <= RangedAttackStrategy.ATTACK_RANGE) {
      // Spawn acid projectile that travels towards the target
      const projectile = new AcidProjectile(zombie.getGameManagers(), zombiePos, playerPos);
      zombie.getEntityManager().addEntity(projectile);

      zombie
        .getGameManagers()
        .getBroadcaster()
        .broadcastEvent(new ZombieAttackedEvent(zombie.getId()));
      zombie.getAttackCooldown().reset();
    }
  }
}

export class SpitterZombie extends BaseEnemy {
  public static readonly Size = new Vector2(16, 16);
  public static readonly ZOMBIE_SPEED = 25; // Slower than regular zombie
  private static readonly ATTACK_DAMAGE = 2;
  private static readonly ATTACK_COOLDOWN = 2; // Longer cooldown for ranged attack
  private static readonly ATTACK_RADIUS = 100; // Much larger attack radius
  public static readonly MAX_HEALTH = 2; // Less health than regular zombie
  private static readonly DROP_CHANCE = 0.5;

  constructor(gameManagers: IGameManagers) {
    super(
      gameManagers,
      Entities.SPITTER_ZOMBIE,
      SpitterZombie.Size,
      SpitterZombie.MAX_HEALTH,
      SpitterZombie.ATTACK_COOLDOWN,
      SpitterZombie.ZOMBIE_SPEED,
      SpitterZombie.DROP_CHANCE,
      SpitterZombie.ATTACK_RADIUS,
      SpitterZombie.ATTACK_DAMAGE
    );

    this.setMovementStrategy(new RangedMovementStrategy());
    this.setAttackStrategy(new RangedAttackStrategy());
  }

  getAttackCooldown(): Cooldown {
    return this.attackCooldown;
  }

  onDamaged(): void {
    this.getGameManagers().getBroadcaster().broadcastEvent(new ZombieHurtEvent(this.getId()));
  }

  onDeath(): void {
    super.onDeath();
    this.getGameManagers().getBroadcaster().broadcastEvent(new ZombieDeathEvent(this.getId()));
  }
}
