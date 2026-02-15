import { Client } from "../../domain/client.js";

export function creerClient(input) {
  return new Client(input);
}
