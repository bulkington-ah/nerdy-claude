"use client";

import dynamic from "next/dynamic";

const TutorSession = dynamic(() => import("@/components/TutorSession"), {
  ssr: false,
});

export default function TutorSessionClient(): React.JSX.Element {
  return <TutorSession />;
}
