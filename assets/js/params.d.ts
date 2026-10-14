// Shape of the build-time data Hugo's js.Build injects as "@params"
// (built in layouts/_partials/chaos-params.html from data/chaos.yaml + data/palettes.yaml;
// skin stylesheets and fonts arrive as fingerprinted URLs).
declare module "@params" {
  export type FontSet = { name: string; display: string; body: string };
  export type ColorSet = { name: string; light?: boolean; vars: Record<string, string> };
  export type Bg = {
    name: string; url: string;
    accent: string; accentText: string; accentInk: string; tint: string;
    scrimTop: string; scrimMid: string; scrimBot: string; glassMix: string;
  };
  export type SkinFont = { family: string; url: string; weight: string; style: string };
  export type Skin = {
    name: string; chance: number; css: string; fonts: SkinFont[];
    title: string; slate: string;
  };
  export const fonts: FontSet[];
  export const skins: Skin[];
  export const colors: ColorSet[];
  export const backgrounds: Bg[];
}
