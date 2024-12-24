import { EventType, ServerSentEvents } from "../events";
import { GameEvent } from "../types";

export class YourIdEvent implements GameEvent<string> {
  private readonly type: EventType;
  private readonly playerId: string;

  constructor(playerId: string) {
    this.type = ServerSentEvents.YOUR_ID;
    this.playerId = playerId;
  }

  getType(): EventType {
    return this.type;
  }

  getPlayerId(): string {
    return this.playerId;
  }

  serialize(): string {
    return this.playerId;
  }
}
