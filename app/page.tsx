import packageJson from "@/package.json";
import { MiniApp } from "@/components/mini-app";

export default function Home() {
  return <MiniApp appVersion={packageJson.version} />;
}
