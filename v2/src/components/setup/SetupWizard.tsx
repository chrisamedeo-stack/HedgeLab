"use client";

import { useSetupStore } from "@/store/setupStore";
import { StepIndicator } from "./StepIndicator";
import { OrgInfoStep } from "./OrgInfoStep";
import { ProfileStep } from "./ProfileStep";
import { HierarchyStep } from "./HierarchyStep";
import { CommodityStep } from "./CommodityStep";
import { ReviewStep } from "./ReviewStep";
import { CompletionView } from "./CompletionView";

export function SetupWizard() {
  const { step } = useSetupStore();

  return (
    <div>
      {step <= 5 && <StepIndicator current={step} />}

      <div className="min-h-[400px]">
        {step === 1 && <OrgInfoStep />}
        {step === 2 && <ProfileStep />}
        {step === 3 && <HierarchyStep />}
        {step === 4 && <CommodityStep />}
        {step === 5 && <ReviewStep />}
        {step === 6 && <CompletionView />}
      </div>
    </div>
  );
}
