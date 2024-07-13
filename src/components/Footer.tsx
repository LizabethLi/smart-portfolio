import Link from "next/link";
import ArtisticAhmedLetters from './ArtisticAhmedLetters';
import AIChatButton from "./AIChatButton";

export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 w-full bg-white">
      <AIChatButton />
      <ArtisticAhmedLetters />
    </footer>
  );
}