import { Suspense } from "react";
import { Evaluator } from "@/components/Evaluator";

export default function Page() {
  return (
    <Suspense>
      <Evaluator />
    </Suspense>
  );
}
