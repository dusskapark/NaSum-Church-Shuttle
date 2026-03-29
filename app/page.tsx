import packageJson from "@/package.json";
import { LiffShuttleApp } from "@/components/liff-shuttle-app";

export default function Home() {
  return <LiffShuttleApp appVersion={packageJson.version} />;
}
