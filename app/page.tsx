import type { Metadata } from "next";
import Game from "./Game";

export const metadata: Metadata = {
  title: "Mossguard: The Acorn Crown",
  description: "A two-player couch co-op woodland brawler starring medieval mice.",
};

export default function Home() {
  return <Game />;
}
