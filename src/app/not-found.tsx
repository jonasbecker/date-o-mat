import Link from "next/link";
import { buttonClass } from "@/components/button";
import { Oops } from "@/components/oops";

export default function NotFound() {
  return (
    <Oops
      emoji="🔍"
      title="Hier ist nichts"
      actions={
        <Link href="/" className={buttonClass("primary", "md", "w-full")}>
          Zur Startseite
        </Link>
      }
    >
      Diese Seite gibt es nicht – vielleicht ein alter Link?
    </Oops>
  );
}
