import { createFileRoute } from "@tanstack/react-router";
import { OdShell } from "@/components/od/shell";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <OdShell />;
}
