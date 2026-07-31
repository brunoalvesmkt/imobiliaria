import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { DomainEventName, DomainEventPayload } from "./domain-event.types";

/**
 * Publicador único de eventos de domínio — módulos emitem sem saber quem
 * (se alguém) está ouvindo (ver ARCHITECTURE.md §4, "eventos de domínio").
 * A Automação é hoje a única consumidora real, mas o desacoplamento vale
 * para qualquer módulo futuro que precise reagir a estes eventos.
 */
@Injectable()
export class DomainEventsService {
  constructor(private readonly emitter: EventEmitter2) {}

  emit(event: DomainEventName, payload: DomainEventPayload): void {
    this.emitter.emit(event, payload);
  }
}
