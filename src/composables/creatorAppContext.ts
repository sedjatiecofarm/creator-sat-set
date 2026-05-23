import type { InjectionKey } from "vue";
import type { useCreatorApp } from "./useCreatorApp";

export type CreatorAppContext = ReturnType<typeof useCreatorApp>;
export const creatorAppKey: InjectionKey<CreatorAppContext> = Symbol("creator-app");
