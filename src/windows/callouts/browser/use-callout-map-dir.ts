import { create } from "zustand";
import { MapDirectory } from "../../../generated-map-directory";

type Realm = { realm: string, mapFiles: string[] };

export const useMapDir = create<{ realms: Realm[] }>(() => ({ realms: [] }));
Object
  .keys(MapDirectory)
  .map(realm => useMapDir.getState().realms.push({ realm, mapFiles: MapDirectory[realm] }));
