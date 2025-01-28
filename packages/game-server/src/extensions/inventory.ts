import { Extension, ExtensionSerialized } from "@/extensions/types";
import { InventoryItem, ITEM_TYPES, ItemType } from "../../../game-shared/src/util/inventory";
import { recipes, RecipeType } from "../../../game-shared/src/util/recipes";
import { Broadcaster } from "@/managers/types";
import { PlayerPickedUpItemEvent } from "@shared/events/server-sent/pickup-item-event";
import Positionable from "@/extensions/positionable";
import { IEntity } from "@/entities/types";
import { MAX_INVENTORY_SLOTS } from "@/constants/constants";
import Vector2 from "@/util/vector2";

export default class Inventory implements Extension {
  public static readonly type = "inventory";

  private self: IEntity;
  private items: InventoryItem[] = [];
  private broadcaster: Broadcaster;

  public constructor(self: IEntity, broadcaster: Broadcaster) {
    this.self = self;
    this.broadcaster = broadcaster;
  }

  public getItems(): InventoryItem[] {
    return this.items;
  }

  public isFull(): boolean {
    return this.items.length >= MAX_INVENTORY_SLOTS;
  }

  public hasItem(itemType: ItemType): boolean {
    return this.items.some((it) => it.itemType === itemType);
  }

  public addItem(item: InventoryItem): void {
    if (this.isFull()) return;

    this.items.push(item);
    this.broadcaster.broadcastEvent(
      new PlayerPickedUpItemEvent({
        playerId: this.self.getId(),
        itemType: item.itemType,
      })
    );
  }

  public removeItem(index: number): InventoryItem | undefined {
    return this.items.splice(index, 1)[0];
  }

  public updateItemState(index: number, state: any): void {
    if (index >= 0 && index < this.items.length) {
      this.items[index].state = state;
    }
  }

  public getActiveItem(index: number | null): InventoryItem | null {
    if (index === null) return null;
    // TODO: refactor this to be 0 based, why are we subtracting 1?
    return this.items[index - 1] ?? null;
  }

  public getActiveWeapon(activeItem: InventoryItem | null): InventoryItem | null {
    const activeItemType = activeItem?.itemType ?? "";
    return ["knife", "shotgun", "pistol"].includes(activeItemType) ? activeItem : null;
  }

  public craftRecipe(recipe: RecipeType): void {
    const foundRecipe = recipes.find((it) => it.getType() === recipe);
    if (foundRecipe === undefined) return;
    this.items = foundRecipe.craft(this.items);
  }

  public addRandomItem(chance = 1): this {
    const items = ITEM_TYPES;
    if (Math.random() < chance) {
      const item = { itemType: items[Math.floor(Math.random() * items.length)] };
      this.addItem(item);
    }
    return this;
  }

  public clear(): void {
    this.items = [];
  }

  public scatterItems(position: { x: number; y: number }): void {
    const offset = 32;
    this.items.forEach((item) => {
      const entity = this.createEntityFromItem(item);
      if (!entity) return;
      const theta = Math.random() * 2 * Math.PI;
      const radius = Math.random() * offset;
      const pos = new Vector2(
        position.x + radius * Math.cos(theta),
        position.y + radius * Math.sin(theta)
      );

      if ("setPosition" in entity) {
        (entity as any).setPosition(pos);
      } else if (entity.hasExt(Positionable)) {
        entity.getExt(Positionable).setPosition(pos);
      }

      this.self.getEntityManager()?.addEntity(entity);
    });
    this.items = [];
  }

  private createEntityFromItem(item: InventoryItem) {
    return this.self.getEntityManager()!.createEntityFromItem(item);
  }

  public serialize(): ExtensionSerialized {
    return {
      type: Inventory.type,
      items: this.items,
    };
  }
}
