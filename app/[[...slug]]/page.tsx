import dynamic from 'next/dynamic';

const MiniAppPage = dynamic(() => import('@/spa/MiniAppPage'), { ssr: false });

export default function CatchAllPage() {
  return <MiniAppPage />;
}
